
import { Font } from './fonts.ts';

export async function pack(name: string, fonts: Font[]) {
	console.log(`   ${name}.tar`)
	console.log(fonts);
	tar.create()
	//let paths = folders ? folders.map(f => './' + f) : ['.'];
	//let cmd = `find ${paths.join(' ')} -name "*.pbf" -print0 | tar -cf ../${name}.tar --null --files-from -`;

	//writeFileSync(
	//	resolve(outputDir, 'fonts.json'),
	//	JSON.stringify(fonts.map(f => f.name), null, '\t')
	//);
	//execSync(cmd, { cwd: outputDir })

	/*
	#!/usr/bin / env bash
	cd "$(dirname "$0")"
	set - e
	
	cd../ dist /
	
		echo "delete temporary glyphs"
	rm - rf fonts
	
	echo "compress tar files"
	gzip - 9f *.tar
	*/
}
