#!/usr/bin/env bash
cd "$(dirname "$0")"
set -e

cd ../dist/

echo " -> tar"
cd fonts
find . -name "*.pbf" -print0 | tar -cf ../fonts.tar --null --files-from -
cd ..

echo " -> gzip"
gzip -9kfv fonts.tar
