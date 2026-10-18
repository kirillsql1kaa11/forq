const THEME_KEY = 'forq-theme';
const ACCENT_KEY = 'forq-accent';

export const THEMES = ['system', 'light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_TEXT: Record<Theme, string> = {
	system: 'Системная',
	light: 'Светлая',
	dark: 'Тёмная'
};

export const ACCENTS = ['indigo', 'emerald', 'amber', 'rose'] as const;

export type Accent = (typeof ACCENTS)[number];

export const ACCENT_TEXT: Record<Accent, string> = {
	indigo: 'Индиго',
	emerald: 'Изумруд',
	amber: 'Янтарь',
	rose: 'Роза'
};

export const ACCENT_SWATCH: Record<Accent, string> = {
	indigo: '#4f46e5',
	emerald: '#047857',
	amber: '#b45309',
	rose: '#be123c'
};

function read(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function write(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		return;
	}
}

export function readTheme(): Theme {
	const stored = read(THEME_KEY);
	return THEMES.includes(stored as Theme) ? (stored as Theme) : 'system';
}

export function readAccent(): Accent {
	const stored = read(ACCENT_KEY);
	return ACCENTS.includes(stored as Accent) ? (stored as Accent) : 'indigo';
}

export function applyTheme(theme: Theme): void {
	const root = document.documentElement;

	if (theme === 'system') delete root.dataset.theme;
	else root.dataset.theme = theme;

	write(THEME_KEY, theme);
}

export function applyAccent(accent: Accent): void {
	const root = document.documentElement;

	if (accent === 'indigo') delete root.dataset.accent;
	else root.dataset.accent = accent;

	write(ACCENT_KEY, accent);
}
