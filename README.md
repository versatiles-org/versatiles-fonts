[![GitHub release](https://img.shields.io/github/v/release/versatiles-org/versatiles-fonts)](https://github.com/versatiles-org/versatiles-fonts/releases/latest)
[![GitHub downloads](https://img.shields.io/github/downloads/versatiles-org/versatiles-fonts/total)](https://github.com/versatiles-org/versatiles-fonts/releases/latest)
[![CI status](https://img.shields.io/github/actions/workflow/status/versatiles-org/versatiles-fonts/release.yml)](https://github.com/versatiles-org/versatiles-fonts/actions/workflows/release.yml)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

# VersaTiles Fonts

**VersaTiles Fonts** provides free font glyphs tailored for map rendering.

## Installation

Clone the repository:

```bash
git clone git@github.com:versatiles-org/versatiles-fonts.git
cd versatiles-fonts
```

Building requires the [`versatiles_glyphs`](https://github.com/versatiles-org/versatiles-glyphs-rs) binary, version 0.10.0 or newer. Install or update it with:

```bash
curl -Ls "https://github.com/versatiles-org/versatiles-glyphs-rs/raw/refs/heads/main/scripts/install.sh" | sh
```

## Building

To generate the font files, run:

```bash
npm run build
```

This will create:

- A `dist/fonts.tar.gz` archive containing all glyphs.
- Separate archives `dist/{font_family}.tar.gz` for each individual font family.
- The same archives as `dist/*.tar.zst`, compressed with zstd level 22 and a 128 MiB long-distance window. They are roughly 40% smaller than the `.tar.gz` archives, and less than half the size for `fonts` and `noto_sans`, because identical glyph ranges shared between faces (e.g. the CJK fallback of Noto Sans Regular and Regular Italic) are compressed only once. Extract them with `tar --zstd -xf fonts.tar.zst` (GNU tar) or `tar -xf fonts.tar.zst` (bsdtar/macOS); no `--long` flag is needed.

Which families are packaged is driven by `fonts.config.ts` (the `build` section), so no font list is hardcoded in the build script.

### Glyph precision

The glyphs are signed distance fields (SDF). To keep the archives small, the build rounds the distance values to a precision of 1/8 px (`sdfStep: 4` in `fonts.config.ts`, passed to `versatiles_glyphs --sdf-step`). This makes the archives about 35% smaller, and the difference is not visible in normal map rendering. If you need full precision (1/32 px), set `sdfStep: 1` and rebuild. You can compare the steps on the [SDF step comparison page](https://versatiles.org/versatiles-glyphs-rs/sdf-step.html).

### Hardlinks for duplicate ranges

Some faces share glyph ranges byte for byte, e.g. Noto Sans Italic uses the same CJK fallback as Noto Sans Regular. With `linkDuplicates: true` in `fonts.config.ts` (the default here), the build writes such ranges as tar hardlinks (`versatiles_glyphs --link-duplicates`), which makes the `.tar.gz` archives much smaller (e.g. `noto_sans.tar.gz` 59 → 31 MB).

**Readers of the archives must support hardlink entries.** Plain `tar -x` (GNU tar, bsdtar/macOS) does. To serve the archives directly, use [VersaTiles](https://github.com/versatiles-org/versatiles-rs) 4.14.0 or newer: older versions skip hardlink entries and return 404 for the linked ranges (e.g. the CJK ranges of the Noto Sans italic faces).

To check that archives with hardlinks extract to exactly the same files as archives without, run:

```bash
npm run verify-links                       # the whole fonts/ tree
npm run verify-links -- "fonts/Noto Sans"  # a single family (faster)
npm run verify-links -- --sample           # a small sample, takes seconds
```

## Available Fonts

VersaTiles Fonts includes the following font families:

- **[Fira Sans](https://fonts.google.com/specimen/Fira+Sans)** by Chris Apostrophe - [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- **[Lato](https://fonts.google.com/specimen/Lato)** by Łukasz Dziedzic - [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- **[Libre Baskerville](https://fonts.google.com/specimen/Libre+Baskerville)** by Impallari Type - [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- **[Merriweather Sans](https://fonts.google.com/specimen/Merriweather+Sans)** by Sorkin Type - [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- **[Noto Sans](https://fonts.google.com/noto/specimen/Noto+Sans)** by Google - [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- **[Nunito](https://fonts.google.com/specimen/Nunito)** by Vernon Adams, Cyreal, and Jacques Le Bailly - [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- **[Open Sans](https://www.opensans.com)** by Steve Matteson - [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- **[PT Sans](https://fonts.google.com/specimen/PT+Sans)** by ParaType - [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- **[Roboto](https://fonts.google.com/specimen/Roboto)** by Christian Robertson - [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0)
- **[Roboto Condensed](https://fonts.google.com/specimen/Roboto+Condensed)** by Christian Robertson - [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- **[Source Sans 3](https://fonts.google.com/specimen/Source+Sans+3)** by Paul D. Hunt - [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)

## Adding Custom Fonts

To add your own fonts:

1. Create a folder within `fonts` containing the `*.ttf` or `*.otf` files of the desired font.
2. Ensure that the font files adhere to the following naming convention:
   - `$family`: The font family name, including any variations (e.g., "Condensed", "Extra Condensed", "Narrow", ...).
   - `$style`: The font style, such as "Thin", "Extra Light", "Light", "Medium", "Regular", "Semi Bold", "Bold", "Extra Bold", or "Black", optionally followed by "Italic".
   - File naming format: `fonts/$family/$family - $style.ttf`.
3. If you need custom file names or want to merge multiple `*.ttf`/`*.otf` files (e.g., when combining character sets exceeding 64K chars), create a `fonts.json` file. Refer to the `fonts/Noto Sans/` directory for an example configuration.
