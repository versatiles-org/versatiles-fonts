#!/bin/bash
cd "$(dirname "$0")"

cd ../dist/

echo " -> compress big pbfs"
find fonts -name "*.pbf" -size +50k | shuf | parallel --bar --eta "brotli -Zfj {}"

echo " -> compress small pbfs"
find fonts -type d -mindepth 1 | parallel --bar --eta "brotli -Zfj {}/*.pbf"

echo " -> tar"
find fonts -name "*.pbf.br" -print0 | tar -cf fonts.tar --null --files-from -

echo " -> gzip"
gzip -9fv fonts.tar

echo " -> upload"
gh release upload latest fonts.tar.gz --clobber
