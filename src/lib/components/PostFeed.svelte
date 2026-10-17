<script lang="ts">
	import type { Snippet } from 'svelte';
	import { createPost, deletePost, editPost, errorMessage, setLike } from '#lib/api';
	import type { PostList } from '#lib/posts.svelte';
	import { session } from '#lib/session.svelte';
	import type { FeedPost } from '#lib/types';
	import Composer from './Composer.svelte';
	import PostCard from './PostCard.svelte';

	let {
		list,
		composer = false,
		empty = 'Пока пусто.',
		header
	}: {
		list: PostList;
		composer?: boolean;
		empty?: string;
		header?: Snippet;
	} = $props();

	async function publish(body: string) {
		if (!session.user) throw new Error('Нужно войти в аккаунт.');

		const placeholder = list.placeholder(
			body,
			session.user.id,
			session.profile?.username ?? '',
			session.profile?.avatar_url ?? null
		);

		try {
			const id = await createPost(body, session.user.id);
			list.settle(placeholder, id);
		} catch (cause) {
			list.drop(placeholder);
			throw cause;
		}
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

{#if composer}
	<Composer onsubmit={publish} />
{/if}

{#if header}
	{@render header()}
{/if}

{#if list.error}
	<p class="alert alert--error" role="alert">{list.error}</p>
{/if}

{#if list.actionError}
	<p class="alert alert--error" role="alert">{list.actionError}</p>
{/if}

{#if list.loading}
	<p class="muted">Загрузка…</p>
{:else if list.items.length === 0}
	<p class="muted feed__empty">{empty}</p>
{:else}
	<div class="feed">
		{#each list.items as post (post.id)}
			<PostCard
				{post}
				currentUserId={session.user?.id ?? null}
				onlike={like}
				onedit={save}
				onremove={remove}
			/>
		{/each}
	</div>

	{#if !list.exhausted}
		<button
			type="button"
			class="btn feed__more"
			onclick={() => list.more()}
			disabled={list.loadingMore}
		>
			{list.loadingMore ? 'Загружаю…' : 'Показать ещё'}
		</button>
	{/if}
{/if}

<style>
	.feed__empty {
		padding-block: 1rem;
	}

	.feed__more {
		width: 100%;
		margin-block-start: 1rem;
	}
</style>
