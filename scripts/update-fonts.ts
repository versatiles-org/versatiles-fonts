#!/usr/bin/env node
/**
 * Download/refresh the fonts in fonts/ as declared in fonts.config.ts,
 * using the latest upstream from github.com/google/fonts.
 *
 * fonts.config.ts is the single source of truth for which fonts this repo
 * ships. Each entry names an output folder, the upstream family on
 * github.com/google/fonts, and the styles to produce. This script materializes
 * each declared file:
 *
 *   - variable font -> instanced at the requested weight/width/italic
 *                      (subset-font / harfbuzz), keeping full glyph coverage
 *   - static font   -> the matching weight/style copied verbatim (matched by
 *                      style name, so irregular upstream file names are fine)
 *
 * Google Fonts now ships variable fonts, while this repo stores static
 * per-weight files (e.g. "Roboto - Bold.ttf"); this bridges the two. Output is
 * written in place, so adding/removing entries in the config adds/removes files
 * here. Files that cannot be resolved are reported and left untouched.
 *
 * Usage:
 *   npm run update-fonts                 # build every font in the config
 *   npm run update-fonts -- --dry-run    # show what would change
 *   npm run update-fonts -- --only "Roboto"   # limit to one folder/name
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { create as createFont, type Font } from 'fontkit';
import subsetFont from 'subset-font';
import { fonts, styleSets, type FontEntry, type StyleSets } from '../fonts.config.ts';

// --- style ladder -----------------------------------------------------------
const WEIGHTS: Record<string, number> = {
	Thin: 100,
	'Extra Light': 200,
	Light: 300,
	Regular: 400,
	Medium: 500,
	'Semi Bold': 600,
	Bold: 700,
	'Extra Bold': 800,
	Black: 900,
};

const LICENSE_DIRS = ['ofl', 'apache', 'ufl'];
const GOOGLE_FONTS_REPO = 'https://github.com/google/fonts';

// --- helpers ----------------------------------------------------------------
const slugify = (family: string) => family.toLowerCase().replace(/[\s-]/g, '');
const normStyle = (style: string) => style.toLowerCase().replace(/[\s-]/g, '');
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function log(kind: string, msg: string): void {
	console.log(`  ${kind.padEnd(7)} ${msg}`);
}

/** 'Bold Italic' -> [700, true]; 'Italic' -> [400, true]. */
function parseStyle(style: string): [number, boolean] | null {
	if (style === 'Italic') return [WEIGHTS['Regular'], true];
	if (style.endsWith(' Italic')) {
		const w = WEIGHTS[style.slice(0, -' Italic'.length)];
		return w === undefined ? null : [w, true];
	}
	const w = WEIGHTS[style];
	return w === undefined ? null : [w, false];
}

// --- config -----------------------------------------------------------------
interface Target {
	dir: string;
	name: string;
	slug: string;
	axes: Record<string, number>;
	style: string;
}

function loadTargets(fonts: FontEntry[], styleSets: StyleSets): Target[] {
	const targets: Target[] = [];
	for (const entry of fonts) {
		const name = entry.name ?? entry.dir;
		const slug = entry.source ?? slugify(name);
		const axes = entry.axes ?? {};
		let styles: string[];
		if (typeof entry.styles === 'string') {
			if (!(entry.styles in styleSets)) throw new Error(`unknown styleSet '${entry.styles}' for ${name}`);
			styles = styleSets[entry.styles];
		} else {
			styles = entry.styles;
		}
		for (const style of styles) targets.push({ dir: entry.dir, name, slug, axes, style });
	}
	return targets;
}

const targetFilename = (t: Target) => `${t.name} - ${t.style}.ttf`;

// --- source resolution ------------------------------------------------------
type Axis = { min: number; default: number; max: number };
interface VfEntry {
	buffer: Buffer;
	axes: Record<string, Axis>;
	italic: boolean;
	hasItal: boolean;
}
interface StaticEntry {
	path: string;
	weight: number;
	italic: boolean;
	namekey: string;
}

class Source {
	readonly dirName: string;
	readonly vfs: VfEntry[] = [];
	readonly statics: StaticEntry[] = [];

	constructor(directory: string) {
		this.dirName = directory.split('/').pop() ?? directory;
		for (const file of readdirSync(directory)
			.filter((f) => f.toLowerCase().endsWith('.ttf'))
			.sort()) {
			const path = join(directory, file);
			const buffer = readFileSync(path);
			const font = createFont(buffer) as Font;
			const axesRaw = (font.variationAxes ?? {}) as Record<string, Axis>;
			const italic = isItalic(file, font);
			if (Object.keys(axesRaw).length > 0) {
				this.vfs.push({
					buffer,
					axes: axesRaw,
					italic,
					hasItal: 'ital' in axesRaw,
				});
			} else {
				const os2 = (font as any)['OS/2'];
				const weight = os2?.usWeightClass ?? 400;
				// Style token from the upstream file name, e.g.
				// "FiraSans-ExtraLight" -> "extralight". More reliable than
				// usWeightClass, which Fira Sans / Lato set non-standard
				// (Thin=250, Extra Light=275).
				const token =
					file
						.replace(/\.ttf$/i, '')
						.split('-')
						.pop() ?? '';
				this.statics.push({ path, weight, italic, namekey: normStyle(token) });
			}
		}
	}

	/** Choose the VF to instance, plus whether to drive an ital axis on it. */
	pickVf(italic: boolean): [VfEntry, boolean] | null {
		if (italic) {
			const dedicated = this.vfs.find((v) => v.italic);
			if (dedicated) return [dedicated, false];
			const roman = this.vfs.find((v) => v.hasItal);
			if (roman) return [roman, true];
			return null;
		}
		const roman = this.vfs.find((v) => !v.italic);
		return roman ? [roman, false] : null;
	}

	pickStatic(weight: number, italic: boolean, namekey: string): StaticEntry | null {
		// Prefer an exact style-name match (robust to non-standard weight class).
		return (
			this.statics.find((s) => s.namekey === namekey) ??
			this.statics.find((s) => s.weight === weight && s.italic === italic) ??
			null
		);
	}
}

function isItalic(file: string, font: Font): boolean {
	if (/italic/i.test(file)) return true;
	if (((font as any).post?.italicAngle ?? 0) !== 0) return true;
	const os2 = (font as any)['OS/2'];
	return Boolean(os2?.fsSelection?.italic);
}

function resolveDir(root: string, slug: string): string | null {
	for (const lic of LICENSE_DIRS) {
		const d = join(root, lic, slug);
		if (existsSync(d)) return d;
	}
	return null;
}

// --- instancing -------------------------------------------------------------
async function instanceVf(
	vf: VfEntry,
	weight: number,
	useItalAxis: boolean,
	extraAxes: Record<string, number>,
): Promise<{ data: Buffer; clamped: string[] }> {
	const want: Record<string, number> = { wght: weight, ...extraAxes };
	if (useItalAxis) want.ital = 1;

	// Pin *every* axis so the result is fully static (unspecified axes stay at
	// their default), clamping requested values into range.
	const variationAxes: Record<string, number> = {};
	const clamped: string[] = [];
	for (const [tag, info] of Object.entries(vf.axes)) {
		if (tag in want) {
			const v = clamp(want[tag], info.min, info.max);
			if (v !== want[tag]) clamped.push(`${tag} ${want[tag]}->${v}`);
			variationAxes[tag] = v;
		} else {
			variationAxes[tag] = info.default;
		}
	}

	// Retain full unicode coverage: feed every codepoint in the source cmap.
	const font = createFont(vf.buffer) as Font;
	const text = (font.characterSet ?? []).map((cp) => String.fromCodePoint(cp)).join('');
	const data = await subsetFont(vf.buffer, text, { variationAxes });
	return { data, clamped };
}

// --- name table (SFNT surgery) ----------------------------------------------
// harfbuzz instancing doesn't rewrite the `name` table, so every instanced
// weight keeps the variable font's default name. These helpers let us give
// each output a distinct, per-weight name table.

/** Compact weight token used in full/PostScript names, e.g. 'Semi Bold' -> 'SemiBold'. */
const WEIGHT_TOKEN: Record<string, string> = {
	Thin: 'Thin',
	'Extra Light': 'ExtraLight',
	Light: 'Light',
	Regular: 'Regular',
	Medium: 'Medium',
	'Semi Bold': 'SemiBold',
	Bold: 'Bold',
	'Extra Bold': 'ExtraBold',
	Black: 'Black',
};

function readSfnt(buf: Buffer): { version: number; tables: Map<string, Buffer> } {
	const numTables = buf.readUInt16BE(4);
	const tables = new Map<string, Buffer>();
	for (let i = 0, p = 12; i < numTables; i++, p += 16) {
		const tag = buf.toString('latin1', p, p + 4);
		const offset = buf.readUInt32BE(p + 8);
		const length = buf.readUInt32BE(p + 12);
		tables.set(tag, buf.subarray(offset, offset + length));
	}
	return { version: buf.readUInt32BE(0), tables };
}

function getTable(buf: Buffer, tag: string): Buffer | null {
	return readSfnt(buf).tables.get(tag) ?? null;
}

function tableChecksum(data: Buffer): number {
	let sum = 0;
	for (let i = 0; i < data.length; i += 4) {
		const v =
			(data[i] ?? 0) * 0x1000000 + ((data[i + 1] ?? 0) << 16) + ((data[i + 2] ?? 0) << 8) + (data[i + 3] ?? 0);
		sum = (sum + v) >>> 0;
	}
	return sum;
}

/** Reassemble a font, replacing its `name` table and fixing the head checksum. */
function withNameTable(font: Buffer, nameTable: Buffer): Buffer {
	const { version, tables } = readSfnt(font);
	tables.set('name', nameTable);
	if (tables.has('head')) {
		const head = Buffer.from(tables.get('head')!); // clone; zero checkSumAdjustment
		head.writeUInt32BE(0, 8);
		tables.set('head', head);
	}

	const tags = [...tables.keys()].sort();
	const entries = tags.map((tag) => ({ tag, data: tables.get(tag)! }));
	let offset = 12 + entries.length * 16;
	const layout = entries.map((e) => {
		const at = offset;
		offset += (e.data.length + 3) & ~3;
		return { ...e, at };
	});

	const out = Buffer.alloc(offset);
	out.writeUInt32BE(version, 0);
	out.writeUInt16BE(entries.length, 4);
	const pow = Math.floor(Math.log2(entries.length));
	out.writeUInt16BE((1 << pow) * 16, 6);
	out.writeUInt16BE(pow, 8);
	out.writeUInt16BE(entries.length * 16 - (1 << pow) * 16, 10);
	let dp = 12;
	for (const e of layout) {
		out.write(e.tag, dp, 4, 'latin1');
		out.writeUInt32BE(tableChecksum(e.data), dp + 4);
		out.writeUInt32BE(e.at, dp + 8);
		out.writeUInt32BE(e.data.length, dp + 12);
		e.data.copy(out, e.at);
		dp += 16;
	}
	const head = layout.find((e) => e.tag === 'head');
	if (head) out.writeUInt32BE((0xb1b0afba - tableChecksum(out)) >>> 0, head.at + 8);
	return out;
}

/** Build a `name` table giving a font a distinct, per-weight identity. */
function buildNameTable(family: string, style: string): Buffer {
	const italic = style === 'Italic' || style.endsWith(' Italic');
	const weight = style === 'Italic' ? 'Regular' : style.replace(/ Italic$/, '');
	const token = WEIGHT_TOKEN[weight] ?? weight;
	const nonRibbi = weight !== 'Regular' && weight !== 'Bold';
	const records: [number, string][] = [
		[1, nonRibbi ? `${family} ${token}` : family], // Family
		[2, nonRibbi ? (italic ? 'Italic' : 'Regular') : italic ? `${weight} Italic`.trim() : weight], // Subfamily
		[4, `${family} ${token}${italic ? ' Italic' : ''}`], // Full name
		[6, `${family.replace(/\s/g, '')}-${token}${italic ? 'Italic' : ''}`], // PostScript
		[16, family], // Typographic family
		[17, style], // Typographic subfamily
	];
	const platforms = [
		{ p: 1, e: 0, l: 0, enc: (s: string) => Buffer.from(s, 'latin1') }, // Mac Roman
		{ p: 3, e: 1, l: 0x409, enc: (s: string) => Buffer.from(s, 'utf16le').swap16() }, // Windows UTF-16BE
	];
	const items = platforms
		.flatMap((pf) => records.map(([id, str]) => ({ ...pf, id, bytes: pf.enc(str) })))
		.sort((a, b) => a.p - b.p || a.e - b.e || a.l - b.l || a.id - b.id);

	const header = Buffer.alloc(6 + items.length * 12);
	header.writeUInt16BE(0, 0); // format 0
	header.writeUInt16BE(items.length, 2);
	header.writeUInt16BE(6 + items.length * 12, 4); // storage offset
	let strOffset = 0;
	for (let i = 0, p = 6; i < items.length; i++, p += 12) {
		const it = items[i];
		header.writeUInt16BE(it.p, p);
		header.writeUInt16BE(it.e, p + 2);
		header.writeUInt16BE(it.l, p + 4);
		header.writeUInt16BE(it.id, p + 6);
		header.writeUInt16BE(it.bytes.length, p + 8);
		header.writeUInt16BE(strOffset, p + 10);
		strOffset += it.bytes.length;
	}
	return Buffer.concat([header, ...items.map((it) => it.bytes)]);
}

// --- build ------------------------------------------------------------------
type Outcome = 'ok' | 'skip' | 'miss' | 'fail';

async function buildTarget(
	root: string,
	fontsDir: string,
	sources: Map<string, Source | null>,
	t: Target,
	dryRun: boolean,
): Promise<Outcome> {
	const parsed = parseStyle(t.style);
	if (!parsed) {
		log('SKIP', `${targetFilename(t)}: unknown style '${t.style}'`);
		return 'skip';
	}
	const [weight, italic] = parsed;

	if (!sources.has(t.slug)) {
		const d = resolveDir(root, t.slug);
		sources.set(t.slug, d ? new Source(d) : null);
	}
	const src = sources.get(t.slug)!;
	if (!src) {
		log('MISS', `${t.name} -> no ofl/apache/ufl/${t.slug} upstream`);
		return 'miss';
	}

	const outDir = join(fontsDir, t.dir);
	const out = join(outDir, targetFilename(t));
	const tmp = `${out}.tmp`;
	const originalBuf = existsSync(out) ? readFileSync(out) : null;
	const picked = src.pickVf(italic);

	try {
		let note = '';
		let data: Buffer;
		if (picked) {
			const [vf, useItal] = picked;
			if (dryRun) {
				const extra = Object.keys(t.axes).length ? ` ${JSON.stringify(t.axes)}` : '';
				log(
					'would',
					`${t.dir}/${targetFilename(t)}  (instance ${t.slug} wght=${weight}${italic ? ' italic' : ''}${extra})`,
				);
				return 'ok';
			}
			const inst = await instanceVf(vf, weight, useItal, t.axes);
			data = inst.data;
			if (inst.clamped.length) note = `  clamp[${inst.clamped.join(', ')}]`;
		} else {
			const stat = src.pickStatic(weight, italic, normStyle(t.style));
			if (!stat) {
				log('MISS', `${targetFilename(t)}: no static wght=${weight}${italic ? ' italic' : ''} in ${src.dirName}`);
				return 'miss';
			}
			if (dryRun) {
				log('would', `${t.dir}/${targetFilename(t)}  (copy ${stat.path.split('/').pop()})`);
				return 'ok';
			}
			data = readFileSync(stat.path);
			note = `  <- ${stat.path.split('/').pop()}`;
		}

		// versatiles_glyphs names each glyph folder from the font's internal
		// name records. harfbuzz instancing leaves every weight with the
		// variable font's default name, which would collapse all weights into
		// one folder. Give each file a distinct name by copying the name table
		// from the file being replaced (reproduces the previous folder names
		// exactly); if there is none, construct one for the instanced weight.
		const nameTable = originalBuf ? getTable(originalBuf, 'name') : null;
		if (nameTable) {
			data = withNameTable(data, nameTable);
		} else if (picked) {
			data = withNameTable(data, buildNameTable(t.name, t.style));
			note += '  (name: constructed)';
		}

		mkdirSync(outDir, { recursive: true });
		writeFileSync(tmp, data);

		// sanity-check before overwriting the tracked file
		const nGlyphs = (createFont(readFileSync(tmp)) as Font).numGlyphs;
		if (nGlyphs < 1) throw new Error('produced font has no glyphs');
		renameSync(tmp, out);
		log('update', `${t.dir}/${targetFilename(t)}  (${nGlyphs} glyphs)${note}`);
		return 'ok';
	} catch (err) {
		if (existsSync(tmp)) rmSync(tmp);
		log('FAIL', `${targetFilename(t)}: ${(err as Error).message}`);
		return 'fail';
	}
}

// --- upstream checkout ------------------------------------------------------
function git(repo: string, ...args: string[]): void {
	execFileSync('git', ['-C', repo, ...args], { stdio: 'inherit' });
}

function ensureCheckout(srcRepo: string): void {
	if (!existsSync(join(srcRepo, '.git'))) {
		console.log('Cloning github.com/google/fonts (sparse, blobless)...');
		mkdirSync(srcRepo, { recursive: true });
		// --sparse starts the cone with only top-level files; sparseCheckout()
		// then materializes just the families the config needs.
		execFileSync('git', ['clone', '--filter=blob:none', '--sparse', GOOGLE_FONTS_REPO, srcRepo], {
			stdio: 'inherit',
		});
	} else {
		console.log('Updating existing google/fonts checkout...');
		git(srcRepo, 'fetch', '--quiet', '--depth', '1', 'origin', 'HEAD');
		git(srcRepo, 'reset', '--quiet', '--hard', 'FETCH_HEAD');
	}
}

function sparseCheckout(srcRepo: string, slugs: Set<string>): void {
	const paths = [...slugs].sort().flatMap((slug) => LICENSE_DIRS.map((lic) => `${lic}/${slug}`));
	git(srcRepo, 'sparse-checkout', 'set', ...paths);
}

// --- main -------------------------------------------------------------------
async function main(): Promise<number> {
	const argv = process.argv.slice(2);
	const only = new Set<string>();
	let dryRun = false,
		printSlugs = false;
	let fontsDir = 'fonts';
	let workDir = process.env.WORK_DIR ?? join(tmpdir(), 'versatiles-fonts-update');
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--dry-run') dryRun = true;
		else if (a === '--print-slugs') printSlugs = true;
		else if (a === '--only') only.add(argv[++i]);
		else if (a === '--fonts-dir') fontsDir = argv[++i];
		else if (a === '--work-dir') workDir = argv[++i];
		else {
			console.error(`Unknown argument: ${a}`);
			return 1;
		}
	}

	let targets = loadTargets(fonts, styleSets);
	if (only.size) {
		targets = targets.filter((t) => only.has(t.dir) || only.has(t.name));
		if (!targets.length) {
			console.error('Nothing matched --only');
			return 1;
		}
	}

	const slugs = new Set(targets.map((t) => t.slug));
	if (printSlugs) {
		console.log([...slugs].sort().join('\n'));
		return 0;
	}

	const srcRepo = join(workDir, 'google-fonts');
	ensureCheckout(srcRepo);
	sparseCheckout(srcRepo, slugs);

	const sources = new Map<string, Source | null>();
	const totals: Record<Outcome, number> = { ok: 0, skip: 0, miss: 0, fail: 0 };
	let current = '';
	for (const t of targets) {
		if (t.dir !== current) {
			current = t.dir;
			console.log(`\n${current}`);
		}
		totals[await buildTarget(srcRepo, fontsDir, sources, t, dryRun)]++;
	}

	console.log(
		`\nSummary: ${totals.ok} updated, ${totals.skip} skipped, ${totals.miss} no-match, ${totals.fail} failed`,
	);
	console.log('\nReview changes with:  git status && git diff --stat');
	return totals.fail ? 1 : 0;
}

main()
	.then((code) => process.exit(code))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
