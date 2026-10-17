<script lang="ts">
	import { BODY_MAX } from '#lib/types';

	let {
		placeholder = 'Что происходит?',
		submitLabel = 'Опубликовать',
		onsubmit
	}: {
		placeholder?: string;
		submitLabel?: string;
		onsubmit: (body: string) => Promise<void>;
	} = $props();

	let body = $state('');
	let busy = $state(false);
	let error = $state('');

	const left = $derived(BODY_MAX - body.length);
	const canSubmit = $derived(body.trim().length > 0 && left >= 0 && !busy);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) return;

		busy = true;
		error = '';

		try {
			await onsubmit(body.trim());
			body = '';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		} finally {
			busy = false;
		}
	}
</script>

<form class="composer" onsubmit={submit}>
	<label class="sr-only" for="composer-body">Текст поста</label>
	<textarea
		id="composer-body"
		class="field__input composer__input"
		bind:value={body}
		maxlength={BODY_MAX}
		placeholder={placeholder}
		rows="2"
	></textarea>

	{#if error}
		<p class="field__error" role="alert">{error}</p>
	{/if}

	<div class="composer__foot">
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
</style>
