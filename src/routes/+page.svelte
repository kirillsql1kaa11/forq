<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { fetchFeed, fetchFollowingFeed } from '#lib/api';
	import PostFeed from '#lib/components/PostFeed.svelte';
	import { PostList } from '#lib/posts.svelte';
	import { session } from '#lib/session.svelte';
	import { FEED_TABS, FEED_TAB_TEXT, type FeedTab } from '#lib/types';

	const all = new PostList(() => fetchFeed());
	const following = new PostList(() => fetchFollowingFeed());
	let loaded: string | undefined = undefined;

	const tab = $derived(toTab(page.url.searchParams.get('tab')));
	const active = $derived(tab === 'following' && session.user ? 'following' : 'all');
	const list = $derived(active === 'following' ? following : all);

	function toTab(value: string | null): FeedTab {
		return FEED_TABS.includes(value as FeedTab) ? (value as FeedTab) : 'all';
	}

	function tabHref(item: FeedTab): string {
		const path = resolve('/');
		return item === 'all' ? path : `${path}?tab=${item}`;
	}

	$effect(() => {
		const userId = session.user?.id ?? null;
		const current = active;
		const key = `${userId ?? ''}|${current}`;
		if (key === loaded) return;
		loaded = key;
		void list.load();
	});
</script>

<svelte:head>
	<title>ForQ</title>
</svelte:head>

{#if session.user}
	<nav class="tabs feed-tabs" aria-label="Лента">
		{#each FEED_TABS as item (item)}
			<a
				class="tabs__tab"
				class:tabs__tab--on={item === tab}
				aria-current={item === tab ? 'page' : undefined}
				href={tabHref(item)}
			>
				{FEED_TAB_TEXT[item]}
			</a>
		{/each}
	</nav>
{/if}

<PostFeed
	{list}
	composer={session.user !== null}
	empty={active === 'following' ? 'Тут появятся посты тех, на кого ты подписан.' : 'Пока пусто.'}
>
	{#snippet header()}
		{#if !session.user}
			<section class="panel stack">
				<h1>ForQ</h1>
				<p class="muted">
					Короткие текстовые посты. Новое сверху, без алгоритмов и бесконечной ленты.
				</p>
				<div class="feed-intro">
					<a class="btn btn--primary" href={resolve('/signup')}>Регистрация</a>
					<a class="btn" href={resolve('/login')}>Вход</a>
				</div>
			</section>
		{/if}
	{/snippet}
</PostFeed>

<style>
	.feed-tabs {
		margin-block-end: 0.75rem;
	}

	.feed-intro {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>
