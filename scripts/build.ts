#!/usr/bin/env node
/**
 * Generate the glyph archives in dist/ from the fonts in fonts/.
 *
 * What gets packaged is configured in the "build" section of fonts.config.ts.
 *
 * Produces, each as .tar.gz and (unless build.zstdLevel is null) as .tar.zst:
 *   - dist/<combinedArchive>.tar.*  — all glyphs (the whole fonts/ tree)
 *   - dist/<family>.tar.*           — one per family listed in build.families
 *
 * The .tar.zst archives use long-distance matching with a 128 MiB window, so
 * identical ranges shared between faces (e.g. the CJK fallback of Noto Sans
 * Regular and Regular Italic) are compressed once. A 2^27 window stays within
 * zstd's default decoder limit, so no `--long` flag is needed to decompress.
 *
 * Requires the `versatiles_glyphs` binary on PATH:
 *   curl -Ls "https://github.com/versatiles-org/versatiles-glyphs-rs/raw/refs/heads/main/scripts/install.sh" | sh
 *
 * Usage:
 *   npm run build
 *   npm run build -- --dry-run    # print the plan without running
 */
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { PassThrough, type Writable } from 'node:stream';
import { constants as zlib, createGzip, createZstdCompress } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { build } from '../fonts.config.ts';

const FONTS_DIR = 'fonts';
const GLYPHS_BIN = 'versatiles_glyphs';

/**
 * zstd window size (log2). 27 = 128 MiB, the largest window decoders accept by
 * default. A larger window (29) saves only ~1.4 % on the combined archive but
 * makes `zstd -d`, `tar --zstd`, Node and versatiles-rs refuse to decompress.
 */
const ZSTD_WINDOW_LOG = 27;

/**
 * Search parameters beyond level 22's defaults, equivalent to
 * `zstd --zstd=clog=30,hlog=30,slog=26,mml=3,tlen=999,strat=9`. They only
 * affect compression (another ~0.3 % smaller, ~4.5 GB RAM and roughly twice the
 * time for the combined archive), so decoding still works with default settings.
 */
const ZSTD_MAX_SEARCH = {
	[zlib.ZSTD_c_chainLog]: 30,
	[zlib.ZSTD_c_hashLog]: 30,
	[zlib.ZSTD_c_searchLog]: 26,
	[zlib.ZSTD_c_minMatch]: 3,
	[zlib.ZSTD_c_targetLength]: 999,
	[zlib.ZSTD_c_strategy]: zlib.ZSTD_btultra2,
};

/** "Fira Sans Extra Condensed" -> "fira_sans_extra_condensed". */
const archiveSlug = (dir: string) => dir.toLowerCase().replace(/[\s-]/g, '_');

interface Output {
	file: string;
	compressor: () => Writable;
}

/**
 * Run `versatiles_glyphs recurse <sourceDir> --tar` once and stream the tar
 * through every compressor in parallel, each into its own output file.
 */
async function buildArchive(sourceDir: string, outputs: Output[]): Promise<void> {
	const proc = spawn(GLYPHS_BIN, ['recurse', sourceDir, '--tar'], {
		stdio: ['ignore', 'pipe', 'inherit'],
	});
	const exited = new Promise<number>((resolve, reject) => {
		proc.on('error', reject);
		proc.on('close', resolve);
	});
	// pipe() to several destinations pauses the source whenever any branch is
	// backed up, so the slow zstd branch doesn't make the gzip branch buffer.
	await Promise.all(
		outputs.map(({ file, compressor }) => {
			const branch = new PassThrough();
			proc.stdout!.pipe(branch);
			return pipeline(branch, compressor(), createWriteStream(file));
		}),
	);
	const code = await exited;
	if (code !== 0) throw new Error(`${GLYPHS_BIN} exited with code ${code} for "${sourceDir}"`);
}

function requireGlyphsBinary(): void {
	try {
		execFileSync(GLYPHS_BIN, ['--version'], { stdio: 'ignore' });
	} catch {
		console.error(
			`error: '${GLYPHS_BIN}' not found on PATH. Install it with:\n` +
				'  curl -Ls "https://github.com/versatiles-org/versatiles-glyphs-rs/raw/refs/heads/main/scripts/install.sh" | sh',
		);
		process.exit(1);
	}
}

async function main(): Promise<void> {
	const dryRun = process.argv.slice(2).includes('--dry-run');
	const outputDir = build.outputDir ?? 'dist';
	const gzipLevel = build.gzipLevel ?? 9;
	const zstdLevel = build.zstdLevel === undefined ? 22 : build.zstdLevel;
	const combined = build.combinedArchive === undefined ? 'fonts' : build.combinedArchive;
	const families = build.families ?? [];

	const formats: { ext: string; label: string; compressor: () => Writable }[] = [
		{ ext: 'tar.gz', label: `gzip -${gzipLevel}`, compressor: () => createGzip({ level: gzipLevel }) },
	];
	if (zstdLevel !== null) {
		formats.push({
			ext: 'tar.zst',
			label: `zstd -${zstdLevel} --long=${ZSTD_WINDOW_LOG}`,
			compressor: () =>
				createZstdCompress({
					params: {
						[zlib.ZSTD_c_compressionLevel]: zstdLevel,
						[zlib.ZSTD_c_enableLongDistanceMatching]: 1,
						[zlib.ZSTD_c_windowLog]: ZSTD_WINDOW_LOG,
						...(zstdLevel === 22 ? ZSTD_MAX_SEARCH : {}),
						// Multithreaded mode matches the size of the `zstd` CLI and is slightly
						// smaller than single-threaded mode with long-distance matching.
						[zlib.ZSTD_c_nbWorkers]: availableParallelism(),
					},
				}),
		});
	}

	// Plan: [sourceDir, archiveName]
	const jobs: [string, string][] = [];
	if (combined) jobs.push([FONTS_DIR, combined]);
	for (const family of families) {
		const src = join(FONTS_DIR, family);
		if (!existsSync(src)) throw new Error(`build.families lists "${family}" but ${src}/ does not exist`);
		jobs.push([src, archiveSlug(family)]);
	}

	if (dryRun) {
		const labels = formats.map((f) => f.label).join(', ');
		console.log(`Would clean ${outputDir}/ and build ${jobs.length * formats.length} archives (${labels}):`);
		for (const [src, name] of jobs) {
			const files = formats.map((f) => `${outputDir}/${name}.${f.ext}`).join(', ');
			console.log(`  ${files}  <-  ${src}`);
		}
		return;
	}

	requireGlyphsBinary();
	rmSync(outputDir, { recursive: true, force: true });
	mkdirSync(outputDir, { recursive: true });

	for (const [src, name] of jobs) {
		const outputs = formats.map((f) => ({ file: join(outputDir, `${name}.${f.ext}`), compressor: f.compressor }));
		await buildArchive(src, outputs);
		for (const { file } of outputs) {
			const kb = (statSync(file).size / 1024).toFixed(0);
			console.log(`  ${file}  (${kb} KB)`);
		}
	}
	console.log(`\nBuilt ${jobs.length * formats.length} archives in ${outputDir}/`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
