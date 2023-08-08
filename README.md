# VersaTiles Fonts

free font glyphs for map rendering

## install, generate and package glyphs

```bash
git clone git@github.com:versatiles-org/versatiles-fonts.git
cd versatiles-fonts
npm install
npm run build
```

Generates a `dist/fonts.tar.gz` with all glyphs.

You can use the release file e.g. like this:
```bash
mkdir fonts
curl -L "https://github.com/versatiles-org/versatiles-fonts/releases/latest/download/fonts.tar.gz" | gzip -d | tar -xf - -C ./fonts/
```

## Fonts

- [Metropolis](https://fontsarena.com/metropolis-by-chris-simpson/), by Chris Simpson, [Public Domain](https://wiki.creativecommons.org/wiki/public_domain)
- [Noto Sans](https://fonts.google.com/noto/specimen/Noto+Sans), by Google, [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- [Open Sans](https://www.opensans.com), by Steve Matteson, [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- [PT Sans](https://company.paratype.com/pt-sans-pt-serif), Alexandra Korolkova, Olga Umpelova, Vladimir Yefimov, [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- [Roboto](https://fonts.google.com/specimen/Roboto), Christian Robertson, [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- [Lato](https://fonts.google.com/specimen/Lato), Lukasz Dziedzic, [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- [Libre Baskerville](https://fonts.google.com/specimen/Libre_Baskerville), Pablo Impallari, Rodrigo Fuenzalida, [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- [Merriweather](https://fonts.google.com/specimen/Merriweather), The Merriweather Project Authors, [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- [Nunito](https://fonts.google.com/specimen/Nunito), The Nunito Project Authors [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
- [Source Sans Pro](https://fonts.google.com/specimen/Source_Sans_Pro), Adobe Systems Incorporated [OFL](https://en.wikipedia.org/wiki/SIL_Open_Font_License)
