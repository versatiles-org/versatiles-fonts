/**
 * Shared helpers for running the `versatiles_glyphs` binary, used by
 * scripts/build.ts and scripts/verify-links.ts.
 */
import { execFileSync } from 'node:child_process';
import type { BuildConfig } from '../fonts.config.ts';

export const GLYPHS_BIN = 'versatiles_glyphs';
/** First release with `--sdf-step`, `--link-duplicates` and deterministic output. */
const GLYPHS_MIN_VERSION = '0.10.0';
const SDF_STEPS = [1, 2, 4, 8, 16, 32, 64];

export interface GlyphOptions {
	sdfStep: number;
	linkDuplicates: boolean;
}

/** Resolve the glyph rendering options from the build config, applying defaults. */
export function glyphOptions(build: BuildConfig): GlyphOptions {
	const sdfStep = build.sdfStep ?? 4;
	if (!SDF_STEPS.includes(sdfStep)) throw new Error(`build.sdfStep must be one of ${SDF_STEPS.join(', ')}`);
	return { sdfStep, linkDuplicates: build.linkDuplicates ?? false };
}

/** Arguments for `versatiles_glyphs recurse <sourceDir> --tar` with the given options. */
export function recurseArgs(sourceDir: string, { sdfStep, linkDuplicates }: GlyphOptions): string[] {
	const args = ['recurse', sourceDir, '--tar', '--sdf-step', String(sdfStep)];
	if (linkDuplicates) args.push('--link-duplicates');
	return args;
}

/** Short description of the options for log output, e.g. "--sdf-step 4 --link-duplicates". */
export function describeOptions({ sdfStep, linkDuplicates }: GlyphOptions): string {
	return `--sdf-step ${sdfStep}${linkDuplicates ? ' --link-duplicates' : ''}`;
}

/** Exit with an install hint unless `versatiles_glyphs` >= GLYPHS_MIN_VERSION is on PATH. */
export function requireGlyphsBinary(): void {
	const install =
		'  curl -Ls "https://github.com/versatiles-org/versatiles-glyphs-rs/raw/refs/heads/main/scripts/install.sh" | sh';
	let output: string;
	try {
		output = execFileSync(GLYPHS_BIN, ['--version'], { encoding: 'utf8' });
	} catch {
		console.error(`error: '${GLYPHS_BIN}' not found on PATH. Install it with:\n${install}`);
		process.exit(1);
	}
	const match = output.match(/(\d+)\.(\d+)\.(\d+)/);
	const version = match ? match.slice(1).map(Number) : null;
	const min = GLYPHS_MIN_VERSION.split('.').map(Number);
	const tooOld = !version || version.reduce((cmp, v, i) => cmp || v - min[i], 0) < 0;
	if (tooOld) {
		console.error(
			`error: '${GLYPHS_BIN}' ${GLYPHS_MIN_VERSION} or newer is required, found "${output.trim()}". Update it with:\n${install}`,
		);
		process.exit(1);
	}
}
