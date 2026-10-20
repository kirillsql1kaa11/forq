import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const width = 1200;
const height = 630;

const background = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
	<defs>
		<radialGradient id="glow" cx="88%" cy="8%" r="70%">
			<stop offset="0" stop-color="#4f46e5" stop-opacity="0.34" />
			<stop offset="1" stop-color="#0a0a0a" stop-opacity="0" />
		</radialGradient>
	</defs>
	<rect width="${width}" height="${height}" fill="#0a0a0a" />
	<rect width="${width}" height="${height}" fill="url(#glow)" />
	<g opacity="0.92">
		<rect x="720" y="128" width="400" height="112" rx="18" fill="#111113" stroke="#27272a" stroke-width="2" />
		<circle cx="758" cy="168" r="16" fill="#3f3f46" />
		<rect x="786" y="160" width="92" height="9" rx="4.5" fill="#52525b" />
		<rect x="758" y="194" width="318" height="9" rx="4.5" fill="#3f3f46" />
		<rect x="758" y="213" width="236" height="9" rx="4.5" fill="#27272a" />
		<rect x="720" y="258" width="400" height="112" rx="18" fill="#111113" stroke="#27272a" stroke-width="2" />
		<circle cx="758" cy="298" r="16" fill="#3f3f46" />
		<rect x="786" y="290" width="74" height="9" rx="4.5" fill="#52525b" />
		<rect x="758" y="324" width="286" height="9" rx="4.5" fill="#3f3f46" />
		<rect x="758" y="343" width="196" height="9" rx="4.5" fill="#27272a" />
		<rect x="720" y="388" width="400" height="112" rx="18" fill="#111113" stroke="#27272a" stroke-width="2" />
		<circle cx="758" cy="428" r="16" fill="#3f3f46" />
		<rect x="786" y="420" width="104" height="9" rx="4.5" fill="#52525b" />
		<rect x="758" y="454" width="300" height="9" rx="4.5" fill="#3f3f46" />
		<rect x="758" y="473" width="214" height="9" rx="4.5" fill="#27272a" />
	</g>
	<text x="228" y="190" font-family="Segoe UI, Arial, sans-serif" font-size="104" font-weight="700" fill="#fafafa" letter-spacing="-4">ForQ</text>
	<text x="88" y="290" font-family="Segoe UI, Arial, sans-serif" font-size="40" fill="#d4d4d8">Короткие текстовые посты</text>
	<text x="88" y="344" font-family="Segoe UI, Arial, sans-serif" font-size="32" fill="#a1a1aa">Без алгоритмов и бесконечной ленты</text>
	<rect x="88" y="400" width="72" height="4" rx="2" fill="#818cf8" />
	<text x="88" y="454" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="#71717a">500 символов · одна лента · только текст</text>
</svg>`;

const mark = await sharp(root('static/mark.png')).resize({ height: 92 }).png().toBuffer();

await sharp(Buffer.from(background))
	.composite([{ input: mark, left: 88, top: 86 }])
	.png()
	.toFile(root('static/og.png'));

console.log(`og.png — ${width}x${height}`);
