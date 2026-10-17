const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 31536000],
	['month', 2592000],
	['day', 86400],
	['hour', 3600],
	['minute', 60],
	['second', 1]
];

const relative = new Intl.RelativeTimeFormat('ru', { numeric: 'auto', style: 'narrow' });
const absolute = new Intl.DateTimeFormat('ru', { dateStyle: 'long', timeStyle: 'short' });
const monthly = new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric' });

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
