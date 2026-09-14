#!/usr/bin/env node
/**
 * Verify that `versatiles_glyphs --link-duplicates` produces archives that
 * extract to exactly the same files as a build without hardlinks.
 *
 * Renders the source directory twice with the glyph options from fonts.config.ts,
 * once without and once with `--link-duplicates`, extracts both tars with the
 * system `tar`, and compares the two trees file by file. Exits with 1 on any
 * difference.
 *
 * Usage:
 *   npm run verify-links                       # the whole fonts/ tree
 *   npm run verify-links -- "fonts/Noto Sans"  # a single family (faster)
 */
import { execFileSync, spawn } from 'node:child_process';
import {
	closeSync,
	createWriteStream,
	existsSync,
	mkdirSync,
	mkdtempSync,
	openSync,
	readFileSync,
	readSync,
	readdirSync,
	rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { build } from '../fonts.config.ts';
import {
	GLYPHS_BIN,
	describeOptions,
	glyphOptions,
	recurseArgs,
	requireGlyphsBinary,
	type GlyphOptions,
} from './glyphs.ts';

/** Render `sourceDir` into a tar file. */
async function renderTar(sourceDir: string, options: GlyphOptions, file: string): Promise<void> {
	const proc = spawn(GLYPHS_BIN, recurseArgs(sourceDir, options), { stdio: ['ignore', 'pipe', 'ignore'] });
	const exited = new Promise<number>((resolve, reject) => {
		proc.on('error', reject);
		proc.on('close', resolve);
	});
	await pipeline(proc.stdout!, createWriteStream(file));
	const code = await exited;
	if (code !== 0) throw new Error(`${GLYPHS_BIN} exited with code ${code} for "${sourceDir}"`);
}

/** Count the entries of an uncompressed tar by type flag ('0' file, '1' hardlink, '5' directory, ...). */
function countTarEntries(file: string): Map<string, number> {
	const counts = new Map<string, number>();
	const header = Buffer.alloc(512);
	const fd = openSync(file, 'r');
	try {
		for (let pos = 0; readSync(fd, header, 0, 512, pos) === 512 && header[0] !== 0;) {
			const type = String.fromCharCode(header[156] || 0x30); // NUL means regular file
			counts.set(type, (counts.get(type) ?? 0) + 1);
			const size = parseInt(header.toString('latin1', 124, 136).replace(/\0.*$/, '').trim() || '0', 8);
			pos += 512 + Math.ceil(size / 512) * 512;
		}
	} finally {
		closeSync(fd);
	}
	return counts;
}

/** All file paths below `dir`, relative to it and sorted. */
function listFiles(dir: string): string[] {
	const files: string[] = [];
	const walk = (current: string): void => {
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			const path = join(current, entry.name);
			if (entry.isDirectory()) walk(path);
			else files.push(relative(dir, path));
		}
	};
	walk(dir);
	return files.sort();
}

/** Compare two extracted trees; returns a list of human-readable differences. */
function compareTrees(a: string, b: string): string[] {
	const filesA = listFiles(a);
	const filesB = new Set(listFiles(b));
	const differences: string[] = [];
	for (const file of filesA) {
		if (!filesB.delete(file)) differences.push(`missing in linked build: ${file}`);
		else if (!readFileSync(join(a, file)).equals(readFileSync(join(b, file))))
			differences.push(`content differs: ${file}`);
	}
	for (const file of filesB) differences.push(`only in linked build: ${file}`);
	return differences;
}

async function main(): Promise<number> {
	const sourceDir = process.argv[2] ?? 'fonts';
	if (!existsSync(sourceDir)) throw new Error(`${sourceDir} does not exist`);
	requireGlyphsBinary();

	const options = glyphOptions(build);
	const plain = { ...options, linkDuplicates: false };
	const linked = { ...options, linkDuplicates: true };

	const work = mkdtempSync(join(tmpdir(), 'versatiles-fonts-verify-links-'));
	try {
		const trees: string[] = [];
		let hardlinks = 0;
		for (const [name, opts] of [
			['plain', plain],
			['linked', linked],
		] as const) {
			const tar = join(work, `${name}.tar`);
			console.log(`Rendering ${sourceDir} (${describeOptions(opts)})...`);
			await renderTar(sourceDir, opts, tar);
			const counts = countTarEntries(tar);
			hardlinks = counts.get('1') ?? 0;
			console.log(`  ${counts.get('0') ?? 0} files, ${hardlinks} hardlinks`);
			const tree = join(work, name);
			mkdirSync(tree);
			execFileSync('tar', ['-xf', tar, '-C', tree], { stdio: 'inherit' });
			rmSync(tar);
			trees.push(tree);
		}

		const differences = compareTrees(trees[0], trees[1]);
		if (differences.length) {
			console.error(`\n${differences.length} differences between the plain and the linked build:`);
			for (const line of differences.slice(0, 20)) console.error(`  ${line}`);
			if (differences.length > 20) console.error(`  ... and ${differences.length - 20} more`);
			return 1;
		}
		if (hardlinks === 0) console.warn(`\nwarning: the linked build contains no hardlinks, so nothing was verified.`);
		console.log(`\nOK: both builds extract to identical trees (${listFiles(trees[1]).length} files).`);
		return 0;
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
}

main()
	.then((code) => process.exit(code))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
