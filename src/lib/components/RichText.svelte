<script lang="ts">
	import { resolve } from '$app/paths';
	import { tokenize } from '#lib/format';

	let { body }: { body: string } = $props();

	const tokens = $derived(tokenize(body));
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
</style>
