#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist

versatiles_glyphs recurse "fonts" --tar | gzip -9 > dist/fonts.tar.gz
versatiles_glyphs recurse "fonts/Fira Sans" --tar | gzip -9 > dist/fira_sans.tar.gz
versatiles_glyphs recurse "fonts/Lato" --tar | gzip -9 > dist/lato.tar.gz
versatiles_glyphs recurse "fonts/Libre Baskerville" --tar | gzip -9 > dist/libre_baskerville.tar.gz
versatiles_glyphs recurse "fonts/Merriweather Sans" --tar | gzip -9 > dist/merriweather_sans.tar.gz
versatiles_glyphs recurse "fonts/Noto Sans" --tar | gzip -9 > dist/noto_sans.tar.gz
versatiles_glyphs recurse "fonts/Nunito" --tar | gzip -9 > dist/nunito.tar.gz
versatiles_glyphs recurse "fonts/Open Sans" --tar | gzip -9 > dist/open_sans.tar.gz
versatiles_glyphs recurse "fonts/PT Sans" --tar | gzip -9 > dist/pt_sans.tar.gz
versatiles_glyphs recurse "fonts/Roboto" --tar | gzip -9 > dist/roboto.tar.gz
versatiles_glyphs recurse "fonts/Source Sans 3" --tar | gzip -9 > dist/source_sans_3.tar.gz
