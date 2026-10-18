export type MarkupResult = {
	value: string;
	start: number;
	end: number;
};

export function applyMarkup(
	value: string,
	start: number,
	end: number,
	mark: string,
	limit: number
): MarkupResult | null {
	const before = value.slice(start - mark.length, start);
	const after = value.slice(end, end + mark.length);
	const selected = value.slice(start, end);

	let next: string;
	let caret: number;

	if (before === mark && after === mark) {
		next = value.slice(0, start - mark.length) + selected + value.slice(end + mark.length);
		caret = Math.max(0, end - mark.length);
	} else {
		next = value.slice(0, start) + mark + selected + mark + value.slice(end);
		caret = selected.length > 0 ? end + mark.length * 2 : start + mark.length;
	}

	if (next.length > limit) return null;

	return { value: next, start: caret, end: caret };
}
