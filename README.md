[![Code Coverage](https://codecov.io/gh/versatiles-org/versatiles-fonts/branch/main/graph/badge.svg?token=IDHAI13M0K)](https://codecov.io/gh/versatiles-org/versatiles-fonts)
[![CI Status](https://img.shields.io/github/actions/workflow/status/versatiles-org/versatiles-fonts/ci.yml)](https://github.com/versatiles-org/versatiles-fonts/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/versatiles-org/versatiles-fonts)](https://github.com/versatiles-org/versatiles-fonts/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/versatiles-org/versatiles-fonts/total)](https://github.com/versatiles-org/versatiles-fonts/releases/latest)

# VersaTiles Fonts

**VersaTiles Fonts** provides free font glyphs tailored for map rendering.

## Installation

Clone the repository and install dependencies:

```bash
git clone git@github.com:versatiles-org/versatiles-fonts.git
cd versatiles-fonts
npm install
```

## Building

To generate the font files, run:

```bash
npm run build
```

This will create:

- A `dist/fonts.tar.gz` archive containing all glyphs.
- Separate archives `dist/{font_family}.tar.gz` for each individual font family.

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
- **[Source Sans 3](https://fonts.google.com/specimen/Source+Sans+3)** by Paul D. Hunt - [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)

## Adding Custom Fonts

To add your own fonts:

1. Create a folder within `fonts` containing the `*.ttf` files of the desired font.
2. Ensure that the font files adhere to the following naming convention:
   - `$family`: The font family name, including any variations (e.g., "Condensed", "Extra Condensed", "Narrow", ...).
   - `$style`: The font style, such as "Thin", "Extra Light", "Light", "Medium", "Regular", "Semi Bold", "Bold", "Extra Bold", or "Black", optionally followed by "Italic".
   - File naming format: `fonts/$family/$family - $style.ttf`.
3. If you need custom file names or want to merge multiple `*.ttf` files (e.g., when combining character sets exceeding 64K chars), create a `fonts.json` file. Refer to the `fonts/Noto Sans/` directory for an example configuration.
