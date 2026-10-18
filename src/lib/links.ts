const POPULAR_HOSTS = [
	'2gis.ru',
	'4pda.to',
	'afisha.ru',
	'anthropic.com',
	'apple.com',
	'arxiv.org',
	'avito.ru',
	'boosty.to',
	'deepseek.com',
	'dev.to',
	'dzen.ru',
	'e1.ru',
	'figma.com',
	'github.com',
	'gitlab.com',
	'google.com',
	'gosuslugi.ru',
	'habr.com',
	'hh.ru',
	'huggingface.co',
	'instagram.com',
	'interfax.ru',
	'kinopoisk.ru',
	'kommersant.ru',
	'lenta.ru',
	'linkedin.com',
	'mail.ru',
	'medium.com',
	'meduza.io',
	'microsoft.com',
	'mos.ru',
	'mozilla.org',
	'npmjs.com',
	'notion.so',
	'novayagazeta.eu',
	'ok.ru',
	'openai.com',
	'ozon.ru',
	'patreon.com',
	'pikabu.ru',
	'pypi.org',
	'python.org',
	'rbc.ru',
	'reddit.com',
	'ria.ru',
	'rutube.ru',
	'sber.ru',
	'soundcloud.com',
	'spotify.com',
	'stackoverflow.com',
	't.me',
	'tass.ru',
	'telegram.org',
	'threads.net',
	'tiktok.com',
	'twitter.com',
	'vc.ru',
	'vedomosti.ru',
	'vk.com',
	'vkvideo.ru',
	'w3.org',
	'wikipedia.org',
	'wildberries.ru',
	'x.com',
	'ya.ru',
	'yandex.ru',
	'youtu.be',
	'youtube.com'
];

const TRAILING = /[,.;:!?…)\]}»"'`]+$/;

export function matchUrl(raw: string): { text: string; href: string } | null {
	const text = raw.replace(TRAILING, '');
	if (text.length === 0) return null;

	let url: URL;

	try {
		url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
	} catch {
		return null;
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

	const host = url.hostname.toLowerCase().replace(/^www\./, '');
	const known = POPULAR_HOSTS.some((item) => host === item || host.endsWith(`.${item}`));

	return known ? { text, href: url.toString() } : null;
}
