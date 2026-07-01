#!/usr/bin/env node
/**
 * Generate the glyph archives in dist/ from the fonts in fonts/.
 *
 * What gets packaged is configured in the "build" section of fonts.config.json.
 *
 * Produces:
 *   - dist/<combinedArchive>.tar.gz  — all glyphs (the whole fonts/ tree)
 *   - dist/<family>.tar.gz           — one per family listed in build.families
 *
 * Requires the `versatiles_glyphs` binary on PATH:
 *   curl -Ls "https://github.com/versatiles-org/versatiles-glyphs-rs/raw/refs/heads/main/scripts/install.sh" | sh
 *
 * Usage:
 *   npm run build
 *   npm run build -- --dry-run    # print the plan without running
 */
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

const FONTS_DIR = 'fonts';
const CONFIG_PATH = 'fonts.config.json';
const GLYPHS_BIN = 'versatiles_glyphs';

interface BuildConfig {
	outputDir?: string;
	gzipLevel?: number;
	combinedArchive?: string | null;
	families?: string[];
}
interface Config {
	build?: BuildConfig;
}

/** "Fira Sans Extra Condensed" -> "fira_sans_extra_condensed". */
const archiveSlug = (dir: string) => dir.toLowerCase().replace(/[\s-]/g, '_');

/** Run `versatiles_glyphs recurse <sourceDir> --tar`, gzip the output to <outFile>. */
async function buildArchive(sourceDir: string, outFile: string, level: number): Promise<void> {
	const proc = spawn(GLYPHS_BIN, ['recurse', sourceDir, '--tar'], {
		stdio: ['ignore', 'pipe', 'inherit'],
	});
	const exited = new Promise<number>((resolve, reject) => {
		proc.on('error', reject);
		proc.on('close', resolve);
	});
	await pipeline(proc.stdout!, createGzip({ level }), createWriteStream(outFile));
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
	const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Config;
	const build = cfg.build ?? {};
	const outputDir = build.outputDir ?? 'dist';
	const level = build.gzipLevel ?? 9;
	const combined = build.combinedArchive === undefined ? 'fonts' : build.combinedArchive;
	const families = build.families ?? [];

	// Plan: [sourceDir, archiveName]
	const jobs: [string, string][] = [];
	if (combined) jobs.push([FONTS_DIR, combined]);
	for (const family of families) {
		const src = join(FONTS_DIR, family);
		if (!existsSync(src)) throw new Error(`build.families lists "${family}" but ${src}/ does not exist`);
		jobs.push([src, archiveSlug(family)]);
	}

	if (dryRun) {
		console.log(`Would clean ${outputDir}/ and build ${jobs.length} archives (gzip -${level}):`);
		for (const [src, name] of jobs) console.log(`  ${outputDir}/${name}.tar.gz  <-  ${src}`);
		return;
	}

	requireGlyphsBinary();
	rmSync(outputDir, { recursive: true, force: true });
	mkdirSync(outputDir, { recursive: true });

	for (const [src, name] of jobs) {
		const outFile = join(outputDir, `${name}.tar.gz`);
		await buildArchive(src, outFile, level);
		const kb = (statSync(outFile).size / 1024).toFixed(0);
		console.log(`  ${outFile}  (${kb} KB)`);
	}
	console.log(`\nBuilt ${jobs.length} archives in ${outputDir}/`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
