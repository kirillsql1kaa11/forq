import { matchUrl } from './links';
import { TAG_MAX } from './types';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 31536000],
	['month', 2592000],
	['day', 86400],
	['hour', 3600],
	['minute', 60],
	['second', 1]
];

const MENTION = /^@([a-z0-9_]{3,24})/i;
const TAG = /^#([^\s#@,.;:!?()[\]{}<>«»"']+)/;
const PROTOCOL_URL = /^(?:https?:\/\/|www\.)[^\s<>"'«»]+/i;
const BARE_URL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::\d{1,5})?(?:\/[^\s<>"'«»]*)?/i;
const GLUED = /[\p{L}\p{N}_]/u;
const BOUNDARY = /[^\p{L}\p{N}_@#./-]/u;

const relative = new Intl.RelativeTimeFormat('ru', { numeric: 'auto', style: 'narrow' });
const absolute = new Intl.DateTimeFormat('ru', { dateStyle: 'long', timeStyle: 'short' });
const monthly = new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric' });

export type TextToken =
	| { kind: 'text'; text: string }
	| { kind: 'mention'; text: string; value: string }
	| { kind: 'tag'; text: string; value: string }
	| { kind: 'link'; text: string; href: string }
	| { kind: 'bold'; text: string }
	| { kind: 'italic'; text: string }
	| { kind: 'code'; text: string };

export function timeAgo(iso: string): string {
	const seconds = (Date.now() - new Date(iso).getTime()) / 1000;

	for (const [unit, size] of UNITS) {
		if (Math.abs(seconds) >= size || unit === 'second') {
			return relative.format(-Math.round(seconds / size), unit);
		}
	}

	return '';
}

export function fullDate(iso: string): string {
	return absolute.format(new Date(iso));
}

export function monthYear(iso: string): string {
	return monthly.format(new Date(iso));
}

export function initials(username: string): string {
	return username.slice(0, 1).toUpperCase();
}

export function plural(count: number, one: string, few: string, many: string): string {
	const mod10 = count % 10;
	const mod100 = count % 100;

	if (mod10 === 1 && mod100 !== 11) return one;
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
	return many;
}

export function plainText(body: string): string {
	return tokenize(body)
		.map((token) => token.text)
		.join('');
}

export function tokenize(body: string): TextToken[] {
	const tokens: TextToken[] = [];
	let text = '';
	let index = 0;

	function flush() {
		if (text.length === 0) return;
		tokens.push({ kind: 'text', text });
		text = '';
	}

	while (index < body.length) {
		const rest = body.slice(index);
		const previous = index > 0 ? body[index - 1] : '';
		const boundary = index === 0 || BOUNDARY.test(previous);

		if (rest.startsWith('`')) {
			const close = rest.indexOf('`', 1);
			if (close > 1) {
				flush();
				tokens.push({ kind: 'code', text: rest.slice(1, close) });
				index += close + 1;
				continue;
			}
		}

		if (rest.startsWith('**')) {
			const close = rest.indexOf('**', 2);
			if (close > 2 && !/\s/.test(rest[2]) && !/\s/.test(rest[close - 1])) {
				flush();
				tokens.push({ kind: 'bold', text: rest.slice(2, close) });
				index += close + 2;
				continue;
			}
		}

		if (rest.startsWith('*') && !rest.startsWith('**')) {
			const close = rest.indexOf('*', 1);
			if (
				close > 1 &&
				rest[close + 1] !== '*' &&
				!/\s/.test(rest[1]) &&
				!/\s/.test(rest[close - 1])
			) {
				flush();
				tokens.push({ kind: 'italic', text: rest.slice(1, close) });
				index += close + 1;
				continue;
			}
		}

		if (boundary) {
			const raw = rest.match(PROTOCOL_URL)?.[0] ?? rest.match(BARE_URL)?.[0];

			if (raw) {
				const link = matchUrl(raw);

				if (link) {
					flush();
					tokens.push({ kind: 'link', text: link.text, href: link.href });
					index += link.text.length;
				} else {
					text += raw;
					index += raw.length;
				}

				continue;
			}
		}

		if (rest[0] === '@' && !(index > 0 && GLUED.test(previous))) {
			const found = rest.match(MENTION);
			if (found && found[1]) {
				flush();
				tokens.push({ kind: 'mention', text: found[0], value: found[1].toLowerCase() });
				index += found[0].length;
				continue;
			}
		}

		if (rest[0] === '#') {
			const found = rest.match(TAG);
			if (found && found[1] && found[1].length <= TAG_MAX) {
				flush();
				tokens.push({ kind: 'tag', text: found[0], value: found[1].toLowerCase() });
				index += found[0].length;
				continue;
			}
		}

		text += body[index];
		index += 1;
	}

	flush();
	return tokens;
}

export function mentionQuery(body: string, caret: number): { start: number; query: string } | null {
	let index = caret;

	while (index > 0 && /[a-z0-9_]/i.test(body[index - 1])) index--;

	if (index === 0 || body[index - 1] !== '@') return null;

	const previous = index > 1 ? body[index - 2] : '';
	if (previous && /[a-z0-9_@]/i.test(previous)) return null;

	const query = body.slice(index, caret).toLowerCase();
	if (query.length > 24) return null;

	return { start: index - 1, query };
}
