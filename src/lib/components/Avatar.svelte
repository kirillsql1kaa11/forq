<script lang="ts">
	import { initials } from '#lib/format';

	let {
		username,
		url = null,
		size = 36
	}: { username: string; url?: string | null; size?: number } = $props();
</script>

<span class="avatar" style="--size: {size}px">
	{#if url}
		<img src={url} alt="" width={size} height={size} loading="lazy" decoding="async" />
	{:else}
		<span aria-hidden="true">{initials(username)}</span>
	{/if}
</span>

<style>
	.avatar {
		display: grid;
		place-items: center;
		flex: none;
		width: var(--size);
		height: var(--size);
		border: 1px solid var(--border);
		border-radius: 50%;
		background: var(--surface);
		color: var(--muted);
		font-size: calc(var(--size) * 0.42);
		font-weight: 600;
		overflow: hidden;
	}

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
