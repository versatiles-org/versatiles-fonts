#!/usr/bin/env node
/**
 * Report how glyph (codepoint) coverage in fonts/ changed, comparing a git ref
 * (default HEAD) against the current working tree. Run it after `update-fonts`
 * to review what a font update added or removed before committing.
 *
 * Usage:
 *   npm run glyph-diff                 # HEAD vs working tree
 *   npm run glyph-diff -- --ref v1.2.3 # a specific ref/commit vs working tree
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { create as createFont, type Font } from 'fontkit';

const FONTS_DIR = 'fonts';

// Major Unicode blocks covering the scripts in this repo (start, end, name).
const BLOCKS: [number, number, string][] = [
	[0x0, 0x7f, 'Basic Latin'],
	[0x80, 0xff, 'Latin-1 Supplement'],
	[0x100, 0x17f, 'Latin Extended-A'],
	[0x180, 0x24f, 'Latin Extended-B'],
	[0x250, 0x2af, 'IPA Extensions'],
	[0x2b0, 0x2ff, 'Spacing Modifiers'],
	[0x300, 0x36f, 'Combining Diacritics'],
	[0x370, 0x3ff, 'Greek'],
	[0x400, 0x4ff, 'Cyrillic'],
	[0x500, 0x52f, 'Cyrillic Supplement'],
	[0x530, 0x58f, 'Armenian'],
	[0x590, 0x5ff, 'Hebrew'],
	[0x600, 0x6ff, 'Arabic'],
	[0x700, 0x74f, 'Syriac'],
	[0x750, 0x77f, 'Arabic Supplement'],
	[0x900, 0x97f, 'Devanagari'],
	[0x980, 0x9ff, 'Bengali'],
	[0xa00, 0xa7f, 'Gurmukhi'],
	[0xa80, 0xaff, 'Gujarati'],
	[0xb00, 0xb7f, 'Oriya'],
	[0xb80, 0xbff, 'Tamil'],
	[0xc00, 0xc7f, 'Telugu'],
	[0xc80, 0xcff, 'Kannada'],
	[0xd00, 0xd7f, 'Malayalam'],
	[0xd80, 0xdff, 'Sinhala'],
	[0xe00, 0xe7f, 'Thai'],
	[0xe80, 0xeff, 'Lao'],
	[0x1000, 0x109f, 'Myanmar'],
	[0x10a0, 0x10ff, 'Georgian'],
	[0x1200, 0x137f, 'Ethiopic'],
	[0x1780, 0x17ff, 'Khmer'],
	[0x1b00, 0x1b7f, 'Balinese'],
	[0x1e00, 0x1eff, 'Latin Extended Additional'],
	[0x1f00, 0x1fff, 'Greek Extended'],
	[0x2000, 0x206f, 'General Punctuation'],
	[0x2070, 0x209f, 'Super/Subscripts'],
	[0x20a0, 0x20cf, 'Currency Symbols'],
	[0x2100, 0x214f, 'Letterlike Symbols'],
	[0x2150, 0x218f, 'Number Forms'],
	[0x2190, 0x21ff, 'Arrows'],
	[0x2200, 0x22ff, 'Math Operators'],
	[0x2300, 0x23ff, 'Misc Technical'],
	[0x2500, 0x257f, 'Box Drawing'],
	[0x25a0, 0x25ff, 'Geometric Shapes'],
	[0x2600, 0x26ff, 'Misc Symbols'],
	[0x2700, 0x27bf, 'Dingbats'],
	[0x3000, 0x303f, 'CJK Symbols/Punct'],
	[0x3040, 0x309f, 'Hiragana'],
	[0x30a0, 0x30ff, 'Katakana'],
	[0x3130, 0x318f, 'Hangul Jamo'],
	[0x4e00, 0x9fff, 'CJK Unified Ideographs'],
	[0xa980, 0xa9df, 'Javanese'],
	[0xac00, 0xd7af, 'Hangul Syllables'],
	[0xe000, 0xf8ff, 'Private Use'],
	[0xfb00, 0xfb4f, 'Alphabetic Presentation'],
	[0xfb50, 0xfdff, 'Arabic Presentation-A'],
	[0xfe70, 0xfeff, 'Arabic Presentation-B'],
	[0xff00, 0xffef, 'Halfwidth/Fullwidth'],
];

function blockOf(cp: number): string {
	for (const [lo, hi, name] of BLOCKS) if (cp >= lo && cp <= hi) return name;
	return cp > 0xffff ? 'Supplementary planes' : 'Other';
}

function charset(buf: Buffer): Set<number> {
	return new Set((createFont(buf) as Font).characterSet);
}

/** *.ttf paths (relative to repo root, forward slashes) under fonts/ on disk. */
function diskFonts(dir: string): string[] {
	const out: string[] = [];
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = `${dir}/${e.name}`;
		if (e.isDirectory()) out.push(...diskFonts(p));
		else if (e.name.toLowerCase().endsWith('.ttf')) out.push(p);
	}
	return out;
}

/** *.ttf paths tracked in <ref> under fonts/. */
function refFonts(ref: string): string[] {
	const out = execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', ref, '--', FONTS_DIR], {
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024,
	});
	return out.split('\0').filter((p) => p.toLowerCase().endsWith('.ttf'));
}

/** Blob bytes of <path> at <ref>, or null if it does not exist there. */
function readRef(ref: string, path: string): Buffer | null {
	try {
		return execFileSync('git', ['show', `${ref}:${path}`], { maxBuffer: 256 * 1024 * 1024 });
	} catch {
		return null;
	}
}

interface FamilyStat {
	files: number;
	oldSum: number;
	newSum: number;
	removed: number;
	added: number;
}

function pad(s: string | number, n: number, left = false): string {
	const str = String(s);
	return left ? str.padStart(n) : str.padEnd(n);
}

function formatBlocks(m: Map<string, number>): string {
	if (m.size === 0) return '  (none)';
	return [...m]
		.sort((a, b) => b[1] - a[1])
		.map(([k, v]) => `  ${pad(k, 28)} ${v}`)
		.join('\n');
}

function main(): number {
	const argv = process.argv.slice(2);
	let ref = 'HEAD';
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--ref') ref = argv[++i];
		else if (argv[i] === '--help') {
			console.log('usage: npm run glyph-diff -- [--ref <git-ref>]');
			return 0;
		} else {
			console.error(`Unknown argument: ${argv[i]}`);
			return 1;
		}
	}

	const paths = [...new Set([...refFonts(ref), ...diskFonts(FONTS_DIR)])].sort();

	const families = new Map<string, FamilyStat>();
	const removedByBlock = new Map<string, number>();
	const addedByBlock = new Map<string, number>();
	const removedCps = new Map<number, Set<string>>(); // cp -> families
	const addedFiles: string[] = [];
	const deletedFiles: string[] = [];
	const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

	for (const path of paths) {
		const family = path.slice(FONTS_DIR.length + 1).split('/')[0];
		const oldBuf = readRef(ref, path);
		const newBuf = existsSync(path) ? readFileSync(path) : null;
		if (!oldBuf && newBuf) addedFiles.push(path);
		if (oldBuf && !newBuf) deletedFiles.push(path);
		if (!oldBuf || !newBuf) continue;

		const oldCp = charset(oldBuf);
		const newCp = charset(newBuf);
		const stat = families.get(family) ?? { files: 0, oldSum: 0, newSum: 0, removed: 0, added: 0 };
		stat.files++;
		stat.oldSum += oldCp.size;
		stat.newSum += newCp.size;
		for (const cp of oldCp) {
			if (!newCp.has(cp)) {
				stat.removed++;
				bump(removedByBlock, blockOf(cp));
				(removedCps.get(cp) ?? removedCps.set(cp, new Set()).get(cp)!).add(family);
			}
		}
		for (const cp of newCp) {
			if (!oldCp.has(cp)) {
				stat.added++;
				bump(addedByBlock, blockOf(cp));
			}
		}
		families.set(family, stat);
	}

	const changed = [...families].filter(([, a]) => a.removed > 0 || a.added > 0);
	if (changed.length === 0 && addedFiles.length === 0 && deletedFiles.length === 0) {
		console.log(`No glyph-coverage changes between ${ref} and the working tree.`);
		return 0;
	}

	console.log(`Glyph coverage: ${ref} -> working tree\n`);
	console.log('=== Per-family codepoint coverage (avg per file, changed families only) ===');
	console.log(`${pad('family', 30)}  files   old→new   removed   added`);
	for (const [f, a] of changed.sort((x, y) => y[1].removed - x[1].removed || y[1].added - x[1].added)) {
		const arrow = `${Math.round(a.oldSum / a.files)}→${Math.round(a.newSum / a.files)}`;
		console.log(
			`${pad(f, 30)}  ${pad(a.files, 4, true)}   ${pad(arrow, 9, true)}   ${pad(a.removed, 7, true)}   ${pad(a.added, 5, true)}`,
		);
	}

	console.log('\n=== Codepoints REMOVED by block (occurrences across all files) ===');
	console.log(formatBlocks(removedByBlock));
	console.log('\n=== Codepoints ADDED by block ===');
	console.log(formatBlocks(addedByBlock));

	if (removedCps.size) {
		console.log(`\n=== Distinct codepoints removed somewhere (${removedCps.size}) ===`);
		const rows = [...removedCps].sort((a, b) => a[0] - b[0]).slice(0, 60);
		for (const [cp, fams] of rows) {
			let ch = '·';
			try {
				ch = cp >= 0x20 && cp !== 0x7f ? String.fromCodePoint(cp) : '·';
			} catch {
				ch = '·';
			}
			console.log(`  U+${cp.toString(16).toUpperCase().padStart(4, '0')}  ${pad(ch, 2)}  ${[...fams].join(', ')}`);
		}
		if (removedCps.size > 60) console.log(`  ... and ${removedCps.size - 60} more`);
	}

	if (addedFiles.length)
		console.log(`\n=== New files (${addedFiles.length}) ===\n${addedFiles.map((p) => '  ' + p).join('\n')}`);
	if (deletedFiles.length)
		console.log(`\n=== Deleted files (${deletedFiles.length}) ===\n${deletedFiles.map((p) => '  ' + p).join('\n')}`);

	return 0;
}

process.exit(main());
