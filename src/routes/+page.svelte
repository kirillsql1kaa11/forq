<script lang="ts">
	import Composer from '#lib/components/Composer.svelte';
	import PostCard from '#lib/components/PostCard.svelte';
	import { createPost, deletePost, editPost, errorMessage, fetchFeed, setLike } from '#lib/api';
	import { PostList } from '#lib/posts.svelte';
	import { session } from '#lib/session.svelte';
	import type { FeedPost } from '#lib/types';

	const list = new PostList(() => fetchFeed());
	let observed: string | null | undefined = undefined;

	$effect(() => {
		const userId = session.user?.id ?? null;
		if (userId === observed) return;
		observed = userId;
		void list.load();
	});

	async function publish(body: string) {
		if (!session.user) throw new Error('Нужно войти в аккаунт.');
		const id = await createPost(body, session.user.id);
		await list.prepend(id);
	}

	async function like(post: FeedPost) {
		if (!session.user) return;
		const next = !post.liked_by_me;

		list.markLike(post.id, next);

		try {
			await setLike(post.id, session.user.id, next);
		} catch (cause) {
			list.markLike(post.id, !next);
			list.actionError = errorMessage(cause);
		}
	}

	async function save(post: FeedPost, body: string) {
		try {
			await editPost(post.id, body);
			list.markBody(post.id, body, new Date().toISOString());
		} catch (cause) {
			list.actionError = errorMessage(cause);
		}
	}

	async function remove(post: FeedPost) {
		try {
			await deletePost(post.id);
			list.drop(post.id);
		} catch (cause) {
			list.actionError = errorMessage(cause);
		}
	}
</script>

<svelte:head>
	<title>ForQ</title>
</svelte:head>

{#if session.user}
	<Composer onsubmit={publish} />
{:else}
	<section class="panel stack">
		<h1>ForQ</h1>
		<p class="muted">
			Короткие текстовые посты. Новое сверху, без алгоритмов и бесконечной ленты.
		</p>
		<div class="intro">
			<a class="btn btn--primary" href="/signup">Регистрация</a>
			<a class="btn" href="/login">Вход</a>
		</div>
	</section>
{/if}

{#if list.actionError}
	<p class="alert alert--error" role="alert">{list.actionError}</p>
{/if}

{#if list.loading}
	<p class="muted">Загрузка…</p>
{:else if list.error}
	<p class="alert alert--error" role="alert">{list.error}</p>
{:else if list.items.length === 0}
	<p class="muted">Пока пусто.</p>
{:else}
	{#each list.items as post (post.id)}
		<PostCard
			{post}
			currentUserId={session.user?.id ?? null}
			onlike={like}
			onedit={save}
			onremove={remove}
		/>
	{/each}

	{#if !list.exhausted}
		<button type="button" class="btn more" onclick={() => list.more()} disabled={list.loadingMore}>
			{list.loadingMore ? 'Загрузка…' : 'Показать ещё'}
		</button>
	{/if}
{/if}

<style>
	.intro {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.more {
		width: 100%;
		margin-block-start: 1rem;
	}
</style>
