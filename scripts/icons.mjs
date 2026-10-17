import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const mark = `
	<circle cx="16" cy="15" r="6.5" />
	<line x1="19.5" y1="18.5" x2="23" y2="22" />`;

function source(size, maskable) {
	const inner = maskable
		? `<g transform="translate(16 16) scale(0.62) translate(-16 -16)">${mark}</g>`
		: mark;

	return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size * 4}" height="${size * 4}" viewBox="0 0 32 32">
		<style>
			rect { fill: #0a0a0a; }
			circle, line { fill: none; stroke: #fafafa; stroke-width: 2.5; stroke-linecap: round; }
		</style>
		<rect width="32" height="32" rx="${maskable ? 0 : 7}" />
		${inner}
	</svg>`);
}

const targets = [
	['icon-192.png', 192, false],
	['icon-512.png', 512, false],
	['icon-maskable-512.png', 512, true],
	['apple-touch-icon.png', 180, false]
];

for (const [name, size, maskable] of targets) {
	await sharp(source(size, maskable)).resize(size, size).png().toFile(fileURLToPath(new URL(`../static/${name}`, import.meta.url)));
	console.log(name);
}
