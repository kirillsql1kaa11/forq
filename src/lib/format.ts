import { TAG_MAX } from './types';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 31536000],
	['month', 2592000],
	['day', 86400],
	['hour', 3600],
	['minute', 60],
	['second', 1]
];

const TOKEN = /@([a-z0-9_]{3,24})|#([^\s#@,.;:!?()[\]{}<>«»"']+)/gi;

const relative = new Intl.RelativeTimeFormat('ru', { numeric: 'auto', style: 'narrow' });
const absolute = new Intl.DateTimeFormat('ru', { dateStyle: 'long', timeStyle: 'short' });
const monthly = new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric' });

export type TextToken =
	| { kind: 'text'; text: string }
	| { kind: 'mention'; text: string; value: string }
	| { kind: 'tag'; text: string; value: string };

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

export function tokenize(body: string): TextToken[] {
	const tokens: TextToken[] = [];
	let cursor = 0;

	for (const match of body.matchAll(TOKEN)) {
		const at = match.index ?? 0;

		if (at > cursor) tokens.push({ kind: 'text', text: body.slice(cursor, at) });

		const previous = at > 0 ? body[at - 1] : '';
		const gluesToWord = /[a-z0-9_]/i.test(previous);

		if (match[1] !== undefined && !gluesToWord) {
			tokens.push({ kind: 'mention', text: match[0], value: match[1].toLowerCase() });
		} else if (match[2] !== undefined && match[2].length <= TAG_MAX) {
			tokens.push({ kind: 'tag', text: match[0], value: match[2].toLowerCase() });
		} else {
			tokens.push({ kind: 'text', text: match[0] });
		}

		cursor = at + match[0].length;
	}

	if (cursor < body.length) tokens.push({ kind: 'text', text: body.slice(cursor) });

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
