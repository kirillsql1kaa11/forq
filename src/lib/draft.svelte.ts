const KEY = 'forq:draft';

class Draft {
	text = $state('');

	constructor() {
		try {
			this.text = localStorage.getItem(KEY) ?? '';
		} catch {
			this.text = '';
		}
	}

	set(value: string): void {
		this.text = value;

		try {
			if (value.length > 0) localStorage.setItem(KEY, value);
			else localStorage.removeItem(KEY);
		} catch {
			return;
		}
	}
}

export const postDraft = new Draft();
