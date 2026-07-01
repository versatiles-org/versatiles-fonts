/**
 * Declarative definition of every font this repo ships — the single source of
 * truth consumed by:
 *   - scripts/update-fonts.ts  (download upstream, instance/copy into fonts/)
 *   - scripts/build.ts         (package fonts/ into dist/*.tar.gz)
 */

/** Named, reusable lists of styles, referenced by FontEntry.styles. */
export type StyleSets = Record<string, string[]>;

export interface FontEntry {
	/** Output folder under fonts/. */
	dir: string;
	/** Filename prefix; defaults to `dir`. */
	name?: string;
	/** google/fonts family slug; defaults to the slugified name. */
	source?: string;
	/** Extra axis pins applied when instancing, e.g. { wdth: 75 }. */
	axes?: Record<string, number>;
	/** A styleSet name, or an inline list of styles. */
	styles: string | string[];
}

export interface BuildConfig {
	/** Output directory for the archives (default "dist"). */
	outputDir?: string;
	/** gzip compression level 0-9 (default 9). */
	gzipLevel?: number;
	/** Name of the combined all-glyphs archive, or null to skip it. */
	combinedArchive?: string | null;
	/** Family folders to also package as individual archives. */
	families?: string[];
}

export interface FontsConfig {
	build: BuildConfig;
	styleSets: StyleSets;
	fonts: FontEntry[];
}

const config: FontsConfig = {
	build: {
		outputDir: 'dist',
		gzipLevel: 9,
		combinedArchive: 'fonts',
		families: [
			'Fira Sans',
			'Lato',
			'Libre Baskerville',
			'Merriweather Sans',
			'Noto Sans',
			'Nunito',
			'Open Sans',
			'PT Sans',
			'Roboto',
			'Source Sans 3',
		],
	},
	styleSets: {
		'regular-bold': ['Regular', 'Bold'],
		'latin-full': [
			'Thin',
			'Thin Italic',
			'Extra Light',
			'Extra Light Italic',
			'Light',
			'Light Italic',
			'Regular',
			'Italic',
			'Medium',
			'Medium Italic',
			'Semi Bold',
			'Semi Bold Italic',
			'Bold',
			'Bold Italic',
			'Extra Bold',
			'Extra Bold Italic',
			'Black',
			'Black Italic',
		],
		'latin-6': [
			'Light',
			'Light Italic',
			'Regular',
			'Italic',
			'Medium',
			'Medium Italic',
			'Semi Bold',
			'Semi Bold Italic',
			'Bold',
			'Bold Italic',
			'Extra Bold',
			'Extra Bold Italic',
		],
		'latin-el-black': [
			'Extra Light',
			'Extra Light Italic',
			'Light',
			'Light Italic',
			'Regular',
			'Italic',
			'Medium',
			'Medium Italic',
			'Semi Bold',
			'Semi Bold Italic',
			'Bold',
			'Bold Italic',
			'Extra Bold',
			'Extra Bold Italic',
			'Black',
			'Black Italic',
		],
	},
	fonts: [
		{
			dir: 'Fira Sans',
			styles: 'latin-full',
		},
		{
			dir: 'Fira Sans Condensed',
			styles: 'latin-full',
		},
		{
			dir: 'Fira Sans Extra Condensed',
			styles: 'latin-full',
		},
		{
			dir: 'Lato',
			styles: [
				'Thin',
				'Thin Italic',
				'Light',
				'Light Italic',
				'Regular',
				'Italic',
				'Bold',
				'Bold Italic',
				'Black',
				'Black Italic',
			],
		},
		{
			dir: 'Libre Baskerville',
			styles: ['Regular', 'Italic', 'Bold'],
		},
		{
			dir: 'Merriweather Sans',
			styles: 'latin-6',
		},
		{
			dir: 'Noto Sans',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Arabic',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Armenian',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Balinese',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Bengali',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Devanagari',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Ethiopic',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Georgian',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Gujarati',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Gurmukhi',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Hebrew',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans JP',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Javanese',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans KR',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Kannada',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Khmer',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Lao',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Myanmar',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Oriya',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans SC',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Sinhala',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Tamil',
			styles: 'regular-bold',
		},
		{
			dir: 'Noto Sans',
			name: 'Noto Sans Thai',
			styles: 'regular-bold',
		},
		{
			dir: 'Nunito',
			styles: 'latin-el-black',
		},
		{
			dir: 'Open Sans',
			styles: 'latin-6',
		},
		{
			dir: 'Open Sans Condensed',
			source: 'opensans',
			axes: {
				wdth: 75,
			},
			styles: 'latin-6',
		},
		{
			dir: 'Open Sans Semi Condensed',
			source: 'opensans',
			axes: {
				wdth: 87.5,
			},
			styles: 'latin-6',
		},
		{
			dir: 'PT Sans',
			styles: ['Regular', 'Italic', 'Bold', 'Bold Italic'],
		},
		{
			dir: 'PT Sans Caption',
			styles: 'regular-bold',
		},
		{
			dir: 'PT Sans Narrow',
			styles: 'regular-bold',
		},
		{
			dir: 'Roboto',
			styles: [
				'Thin',
				'Thin Italic',
				'Light',
				'Light Italic',
				'Regular',
				'Italic',
				'Medium',
				'Medium Italic',
				'Bold',
				'Bold Italic',
				'Black',
				'Black Italic',
			],
		},
		{
			dir: 'Roboto Condensed',
			styles: 'latin-full',
		},
		{
			dir: 'Source Sans 3',
			styles: 'latin-el-black',
		},
	],
};

export default config;
