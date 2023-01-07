# free font glyphs for map rendering

## install, generate and package glyphs

```bash
git clone git@github.com:opencloudtiles/opencloudtiles-fonts.git
cd opencloudtiles-fonts
npm install
npm run generate
npm run release
```

Generates a `dist/fonts.tar.gz` with all glyphs.

You can use the release file e.g. like this:
```bash
mkdir fonts
curl -L "https://github.com/OpenCloudTiles/opencloudtiles-fonts/releases/latest/download/fonts.tar.gz" | gzip -d | tar -xf - -C ./fonts/
```

## Fonts

- [Metropolis](https://fontsarena.com/metropolis-by-chris-simpson/), by Chris Simpson, [Public Domain](https://wiki.creativecommons.org/wiki/public_domain)
- [Noto Sans](https://fonts.google.com/noto/specimen/Noto+Sans), by Google, [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- [Open Sans](https://www.opensans.com), by Steve Matteson, [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- [PT Sans](https://company.paratype.com/pt-sans-pt-serif), Alexandra Korolkova, Olga Umpelova, Vladimir Yefimov, [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- [Roboto](https://fonts.google.com/specimen/Roboto), Christian Robertson, [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0)

