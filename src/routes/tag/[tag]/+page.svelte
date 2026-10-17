<script lang="ts">
	import { page } from '$app/state';
	import { fetchTagFeed } from '#lib/api';
	import PostFeed from '#lib/components/PostFeed.svelte';
	import { PostList } from '#lib/posts.svelte';
	import { session } from '#lib/session.svelte';

	const tag = $derived((page.params.tag ?? '').toLowerCase());
	const list = new PostList((cursor) => fetchTagFeed(tag, cursor));
	let observed: string | undefined = undefined;

	$effect(() => {
		const current = `${tag}|${session.user?.id ?? ''}`;
		if (current === observed) return;
		observed = current;
		void list.load();
	});
</script>

<svelte:head>
	<title>#{tag} — ForQ</title>
</svelte:head>

<PostFeed {list} empty="По этому тегу постов пока нет.">
	{#snippet header()}
		<h1 class="tag__title">#{tag}</h1>
	{/snippet}
</PostFeed>

<style>
	.tag__title {
		padding-block-end: 0.75rem;
		border-bottom: 1px solid var(--border);
	}
</style>
