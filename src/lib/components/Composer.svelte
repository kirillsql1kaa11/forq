<script lang="ts">
	import { untrack } from 'svelte';
	import { searchProfiles } from '#lib/api';
	import { postDraft } from '#lib/draft.svelte';
	import { mentionQuery } from '#lib/format';
	import { BODY_MAX, type MentionCandidate } from '#lib/types';
	import Avatar from './Avatar.svelte';
	import RichText from './RichText.svelte';

	let {
		placeholder = 'Что происходит?',
		submitLabel = 'Опубликовать',
		autofocus = false,
		persist = false,
		onsubmit
	}: {
		placeholder?: string;
		submitLabel?: string;
		autofocus?: boolean;
		persist?: boolean;
		onsubmit: (body: string) => Promise<void>;
	} = $props();

	let body = $state(untrack(() => (persist ? postDraft.text : '')));
	let busy = $state(false);
	let error = $state('');
	let field = $state<HTMLTextAreaElement | null>(null);
	let suggestions = $state<MentionCandidate[]>([]);
	let mention = $state<{ start: number; query: string } | null>(null);
	let highlighted = $state(0);
	let preview = $state(false);
	let ticket = 0;

	const left = $derived(BODY_MAX - body.length);
	const canSubmit = $derived(body.trim().length > 0 && left >= 0 && !busy);
	const shown = $derived(preview && body.trim().length > 0);

	$effect(() => {
		if (autofocus && field) field.focus();
	});

	function reset() {
		suggestions = [];
		mention = null;
		highlighted = 0;
	}

	function setDraft(value: string) {
		if (persist) postDraft.set(value);
	}

	function oninput(event: Event) {
		const element = event.currentTarget as HTMLTextAreaElement;
		const found = mentionQuery(element.value, element.selectionStart ?? element.value.length);

		setDraft(element.value);
		mention = found;
		highlighted = 0;

		if (!found) {
			suggestions = [];
			return;
		}

		const current = ++ticket;
		void searchProfiles(found.query).then((rows) => {
			if (current === ticket) suggestions = rows;
		});
	}

	function insert(candidate: MentionCandidate) {
		if (!mention || !field) return;

		const caret = field.selectionStart ?? body.length;
		const head = body.slice(0, mention.start);
		const text = `@${candidate.username} `;

		body = head + text + body.slice(caret);
		setDraft(body);

		const next = head.length + text.length;
		void Promise.resolve().then(() => {
			field?.focus();
			field?.setSelectionRange(next, next);
		});

		reset();
	}

	function onkeydown(event: KeyboardEvent) {
		if (suggestions.length === 0) return;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			highlighted = (highlighted + 1) % suggestions.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			highlighted = (highlighted - 1 + suggestions.length) % suggestions.length;
		} else if (event.key === 'Enter' || event.key === 'Tab') {
			event.preventDefault();
			insert(suggestions[highlighted]);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			reset();
		}
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) return;

		const text = body.trim();
		body = '';
		setDraft('');
		reset();
		busy = true;
		error = '';

		try {
			await onsubmit(text);
		} catch (cause) {
			body = text;
			setDraft(text);
			error = cause instanceof Error ? cause.message : String(cause);
		} finally {
			busy = false;
		}
	}
</script>

<form class="composer" onsubmit={submit}>
	<label class="sr-only" for="composer-body">Текст</label>

	<div class="composer__field">
		<textarea
			id="composer-body"
			bind:this={field}
			class="field__input composer__input"
			bind:value={body}
			oninput={oninput}
			onkeydown={onkeydown}
			maxlength={BODY_MAX}
			placeholder={placeholder}
			rows="2"
			autocomplete="off"
			aria-autocomplete="list"
		></textarea>

		{#if suggestions.length > 0}
			<ul class="mentions" id="composer-mentions" role="listbox" aria-label="Кого упомянуть">
				{#each suggestions as candidate, index (candidate.username)}
					<li role="option" aria-selected={index === highlighted}>
						<button
							type="button"
							class="mentions__item"
							class:mentions__item--on={index === highlighted}
							onmouseenter={() => (highlighted = index)}
							onclick={() => insert(candidate)}
						>
							<Avatar username={candidate.username} url={candidate.avatar_url} size={24} />
							<span>@{candidate.username}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if shown}
		<div class="composer__preview">
			<RichText body={body} />
		</div>
	{/if}

	{#if error}
		<p class="field__error" role="alert">{error}</p>
	{/if}

	<div class="composer__foot">
		{#if body.trim().length > 0}
			<button
				type="button"
				class="btn btn--quiet composer__toggle"
				aria-pressed={preview}
				onclick={() => (preview = !preview)}
			>
				{preview ? 'Скрыть' : 'Предпросмотр'}
			</button>
		{/if}
		<span class="composer__count" class:composer__count--low={left < 50}>{left}</span>
		<button type="submit" class="btn btn--primary" disabled={!canSubmit}>
			{submitLabel}
		</button>
	</div>
</form>

<style>
	.composer {
		display: grid;
		gap: 0.5rem;
		padding-block: 1rem;
		border-bottom: 1px solid var(--border);
	}

	.composer__field {
		position: relative;
	}

	.composer__input {
		min-height: 4rem;
		field-sizing: content;
		max-height: 40vh;
		resize: none;
	}

	.composer__foot {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	.composer__count {
		color: var(--muted);
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
	}

	.composer__count--low {
		color: var(--danger);
	}

	.composer__toggle {
		margin-inline-end: auto;
		min-height: auto;
		padding-block: 0.25rem;
	}

	.composer__preview {
		padding-block: 0.25rem;
		padding-inline-start: 0.75rem;
		border-inline-start: 2px solid var(--border);
		overflow-wrap: anywhere;
	}

	.mentions {
		position: absolute;
		inset-inline: 0;
		top: 100%;
		z-index: 20;
		display: grid;
		gap: 0.125rem;
		margin: 0.25rem 0 0;
		padding: 0.25rem;
		list-style: none;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg);
		box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
	}

	.mentions__item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		min-height: 2.25rem;
		padding-inline: 0.5rem;
		border: 0;
		border-radius: calc(var(--radius) - 2px);
		background: transparent;
		text-align: start;
	}

	.mentions__item--on {
		background: var(--surface);
	}
</style>
