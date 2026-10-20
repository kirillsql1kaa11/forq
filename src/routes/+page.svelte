<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { errorMessage, fetchFeed, fetchFollowingFeed, fetchRandomPost } from '#lib/api';
	import PostFeed from '#lib/components/PostFeed.svelte';
	import { PostList } from '#lib/posts.svelte';
	import { session } from '#lib/session.svelte';
	import { FEED_TABS, FEED_TAB_TEXT, type FeedTab } from '#lib/types';

	const all = new PostList(() => fetchFeed());
	const following = new PostList(() => fetchFollowingFeed());
	let loaded: string | undefined = undefined;
	let randomBusy = $state(false);
	let randomError = $state('');

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

	async function random() {
		if (randomBusy) return;

		randomBusy = true;
		randomError = '';

		try {
			const post = await fetchRandomPost();

			if (!post) {
				randomError = 'Постов пока нет.';
				return;
			}

			await goto(resolve('/p/[id]', { id: String(post.id) }));
		} catch (cause) {
			randomError = errorMessage(cause);
		} finally {
			randomBusy = false;
		}
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

<div class="feed-bar">
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
	{:else}
		<span class="feed-bar__spacer" aria-hidden="true"></span>
	{/if}

	<button
		type="button"
		class="btn btn--quiet feed-random"
		onclick={random}
		disabled={randomBusy}
		title="Открыть случайный пост"
	>
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
			<rect x="4" y="4" width="16" height="16" rx="4" />
			<circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
			<circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" />
			<circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
			<circle cx="9" cy="15" r="1" fill="currentColor" stroke="none" />
			<circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" />
		</svg>
		{randomBusy ? 'Ищу…' : 'Случайный пост'}
	</button>
</div>

{#if randomError}
	<p class="alert alert--error" role="alert">{randomError}</p>
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
	.feed-bar {
		display: flex;
		align-items: stretch;
		gap: 0.5rem;
		margin-block-end: 0.75rem;
		border-bottom: 1px solid var(--border);
	}

	.feed-tabs {
		flex: 1;
		min-width: 0;
		border-bottom: 0;
	}

	.feed-bar__spacer {
		flex: 1;
	}

	.feed-random {
		flex: none;
		align-self: center;
		min-height: 2.25rem;
		margin-block-end: 0.25rem;
		padding-inline: 0.6rem;
		font-size: 0.8125rem;
		white-space: nowrap;
	}

	.feed-intro {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>
