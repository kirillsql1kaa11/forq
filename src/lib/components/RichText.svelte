<script lang="ts">
	import { resolve } from '$app/paths';
	import { tokenize } from '#lib/format';

	let { body }: { body: string } = $props();

	const tokens = $derived(tokenize(body));
	let opened = $state<Set<number>>(new Set());
	let lastBody: string | undefined = undefined;

	$effect.pre(() => {
		if (body === lastBody) return;
		lastBody = body;
		opened = new Set();
	});

	function toggle(index: number) {
		const next = new Set(opened);
		if (next.has(index)) next.delete(index);
		else next.add(index);
		opened = next;
	}
</script>

<p class="rich">
	{#each tokens as token, index (index)}
		{#if token.kind === 'mention'}
			<a href={resolve('/u/[username]', { username: token.value })} class="rich__link">{token.text}</a>
		{:else if token.kind === 'tag'}
			<a href={resolve('/tag/[tag]', { tag: token.value })} class="rich__link">{token.text}</a>
		{:else if token.kind === 'link'}
			<a
				href={token.href}
				class="rich__link"
				target="_blank"
				rel="noopener noreferrer nofollow ugc">{token.text}</a>
		{:else if token.kind === 'bold'}
			<strong>{token.text}</strong>
		{:else if token.kind === 'italic'}
			<em>{token.text}</em>
		{:else if token.kind === 'code'}
			<code>{token.text}</code>
		{:else if token.kind === 'spoiler'}
			<button
				type="button"
				class="rich__spoiler"
				class:rich__spoiler--open={opened.has(index)}
				aria-expanded={opened.has(index)}
				title={opened.has(index) ? 'Скрыть спойлер' : 'Показать спойлер'}
				onclick={() => toggle(index)}
			>
				{opened.has(index) ? token.text : 'Спойлер'}
			</button>
		{:else}
			{token.text}
		{/if}
	{/each}
</p>

<style>
	.rich {
		margin: 0;
		white-space: pre-wrap;
	}

	.rich__link {
		color: var(--accent);
	}

	.rich__spoiler {
		display: inline-block;
		max-width: 100%;
		padding: 0 0.3em;
		border: 1px dashed color-mix(in srgb, var(--muted) 55%, transparent);
		border-radius: 4px;
		background: color-mix(in srgb, var(--fg) 5%, transparent);
		color: var(--muted);
		font: inherit;
		line-height: inherit;
		text-align: start;
		white-space: pre-wrap;
		vertical-align: baseline;
		transition:
			color 150ms ease,
			border-color 150ms ease,
			background-color 150ms ease;
	}

	.rich__spoiler:hover {
		border-color: var(--muted);
		color: var(--fg);
	}

	.rich__spoiler--open {
		border-color: transparent;
		background: color-mix(in srgb, var(--fg) 6%, transparent);
		color: inherit;
	}
</style>
