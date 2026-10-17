<script lang="ts">
	import { resolve } from '$app/paths';
	import { fetchFeed } from '#lib/api';
	import PostFeed from '#lib/components/PostFeed.svelte';
	import { PostList } from '#lib/posts.svelte';
	import { session } from '#lib/session.svelte';

	const list = new PostList(() => fetchFeed());
	let observed: string | null | undefined = undefined;

	$effect(() => {
		const userId = session.user?.id ?? null;
		if (userId === observed) return;
		observed = userId;
		void list.load();
	});
</script>

<svelte:head>
	<title>ForQ</title>
</svelte:head>

<PostFeed {list} composer={session.user !== null}>
	{#snippet header()}
		{#if !session.user}
			<section class="panel stack">
				<h1>ForQ</h1>
				<p class="muted">
					Короткие текстовые посты. Новое сверху, без алгоритмов и бесконечной ленты.
				</p>
				<div class="intro">
					<a class="btn btn--primary" href={resolve('/signup')}>Регистрация</a>
					<a class="btn" href={resolve('/login')}>Вход</a>
				</div>
			</section>
		{/if}
	{/snippet}
</PostFeed>

<style>
	.intro {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>
