import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

try {
	process.loadEnvFile('.env');
} catch {}

const site = (process.env.SITE_URL || process.env.URL || 'http://localhost:5173').replace(
	/\/+$/,
	''
);
const file = fileURLToPath(new URL('../build/index.html', import.meta.url));
const html = await readFile(file, 'utf8');

await writeFile(file, html.replaceAll('http://localhost:5173', site));
