import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

const SOURCE = root('branding/logo.png');
const BG = '#0a0a0a';
const GAP = 6;
const CUT = 32;

const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

const brightness = (index) => Math.max(data[index], data[index + 1], data[index + 2]);

const bands = [];
let start = null;
let hole = 0;

for (let y = 0; y < info.height; y += 1) {
	let peak = 0;

	for (let x = 0; x < info.width; x += 1) {
		const value = brightness((y * info.width + x) * 4);
		if (value > peak) peak = value;
	}

	if (peak > CUT) {
		if (start === null) start = y;
		hole = 0;
	} else if (start !== null) {
		hole += 1;
		if (hole > GAP) {
			bands.push([start, y - hole]);
			start = null;
			hole = 0;
		}
	}
}

if (start !== null) bands.push([start, info.height - 1]);

if (bands.length === 0) throw new Error(`${SOURCE}: на картинке нет светлых пикселей`);
if (bands.length < 2) throw new Error(`${SOURCE}: не нашёл отдельно знак и надпись`);

const [top] = bands;

let left = info.width;
let right = 0;

for (let y = top[0]; y <= top[1]; y += 1) {
	for (let x = 0; x < info.width; x += 1) {
		if (brightness((y * info.width + x) * 4) <= CUT) continue;
		if (x < left) left = x;
		if (x > right) right = x;
	}
}

const width = right - left + 1;
const height = top[1] - top[0] + 1;
const mark = Buffer.alloc(width * height * 4);

for (let y = 0; y < height; y += 1) {
	for (let x = 0; x < width; x += 1) {
		const from = ((top[0] + y) * info.width + left + x) * 4;
		const to = (y * width + x) * 4;
		const value = brightness(from);
		const alpha = value <= CUT ? 0 : Math.round(((value - CUT) / (255 - CUT)) * 255);

		mark[to] = 255;
		mark[to + 1] = 255;
		mark[to + 2] = 255;
		mark[to + 3] = alpha;
	}
}

const glyph = await sharp(mark, { raw: { width, height, channels: 4 } }).png().toBuffer();

await sharp(glyph).toFile(root('static/mark.png'));

async function icon(size, scale, rounded) {
	const inner = Math.round(size * scale);
	const scaled = await sharp(glyph)
		.resize({ width: inner, height: inner, fit: 'inside' })
		.png()
		.toBuffer();

	const canvas = Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${rounded ? Math.round(size * 0.22) : 0}" fill="${BG}" /></svg>`
	);

	return sharp(canvas).composite([{ input: scaled, gravity: 'center' }]).png().toBuffer();
}

const targets = [
	['icon-192.png', 192, 0.72, true],
	['icon-512.png', 512, 0.72, true],
	['icon-maskable-512.png', 512, 0.56, false],
	['apple-touch-icon.png', 180, 0.72, false],
	['favicon-32.png', 32, 0.76, true],
	['favicon-16.png', 16, 0.82, true]
];

for (const [name, size, scale, rounded] of targets) {
	await sharp(await icon(size, scale, rounded)).toFile(root(`static/${name}`));
	console.log(`${name} — знак ${width}x${height} из ${info.width}x${info.height}`);
}
