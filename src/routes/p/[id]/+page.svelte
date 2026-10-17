<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Avatar from '#lib/components/Avatar.svelte';
	import Composer from '#lib/components/Composer.svelte';
	import PostCard from '#lib/components/PostCard.svelte';
	import {
		createComment,
		deleteComment,
		deletePost,
		editPost,
		errorMessage,
		fetchComments,
		fetchPost,
		setLike
	} from '#lib/api';
	import { timeAgo } from '#lib/format';
	import { session } from '#lib/session.svelte';
	import type { Comment, FeedPost } from '#lib/types';

	let post = $state<FeedPost | null>(null);
	let comments = $state<Comment[]>([]);
	let loading = $state(true);
	let notFound = $state(false);
	let actionError = $state('');
	let currentId: number | undefined = undefined;
	let currentUser: string | null | undefined = undefined;

	$effect(() => {
		const id = Number(page.params.id);
		const userId = session.user?.id ?? null;
		if (id === currentId && userId === currentUser) return;
		currentId = id;
		currentUser = userId;
		void load(id);
	});

	async function load(id: number) {
		loading = true;
		notFound = false;

		try {
			const found = await fetchPost(id);

			if (!found) {
				post = null;
				notFound = true;
				return;
			}

			post = found;
			comments = await fetchComments(id);
		} catch (cause) {
			actionError = errorMessage(cause);
		} finally {
			loading = false;
		}
	}

	async function like(target: FeedPost) {
		if (!session.user || !post) return;
		const next = !target.liked_by_me;

		post = { ...post, liked_by_me: next, like_count: post.like_count + (next ? 1 : -1) };

		try {
			await setLike(target.id, session.user.id, next);
		} catch (cause) {
			post = { ...post, liked_by_me: !next, like_count: post.like_count + (next ? -1 : 1) };
			actionError = errorMessage(cause);
		}
	}

	async function save(target: FeedPost, body: string) {
		if (!post) return;

		try {
			await editPost(target.id, body);
			post = { ...post, body, edited_at: new Date().toISOString() };
		} catch (cause) {
			actionError = errorMessage(cause);
		}
	}

	async function remove(target: FeedPost) {
		if (!post) return;

		try {
			await deletePost(target.id);
			post = { ...post, body: 'Пост удалён', edited_at: null };
		} catch (cause) {
			actionError = errorMessage(cause);
		}
	}

	async function comment(body: string) {
		if (!session.user || !post) throw new Error('Нужно войти в аккаунт.');

		await createComment(post.id, session.user.id, body);

		post = { ...post, comment_count: post.comment_count + 1 };
		comments = await fetchComments(post.id);
	}

	async function dropComment(target: Comment) {
		try {
			await deleteComment(target.id);
			comments = comments.filter((item) => item.id !== target.id);
			if (post) post = { ...post, comment_count: Math.max(0, post.comment_count - 1) };
		} catch (cause) {
			actionError = errorMessage(cause);
		}
	}
</script>

<svelte:head>
	<title>{post ? `Пост @${post.username} — ForQ` : 'Пост — ForQ'}</title>
</svelte:head>

{#if loading}
	<p class="muted">Загрузка…</p>
{:else if notFound || !post}
	<h1>Пост не найден</h1>
	<p class="muted">Возможно, его удалили.</p>
{:else}
	<PostCard
		{post}
		currentUserId={session.user?.id ?? null}
		onlike={like}
		onedit={save}
		onremove={remove}
	/>

	{#if actionError}
		<p class="alert alert--error" role="alert">{actionError}</p>
	{/if}

	{#if session.user}
		<Composer placeholder="Ответить…" submitLabel="Ответить" onsubmit={comment} />
	{:else}
		<p class="muted comments__guest">
			<a href={resolve('/login')}>Войди</a>, чтобы ответить.
		</p>
	{/if}

	{#if comments.length === 0}
		<p class="muted comments__empty">Ответов пока нет.</p>
	{:else}
		<ul class="comments">
			{#each comments as item (item.id)}
				<li class="comment">
					<Avatar username={item.profiles?.username ?? '?'} url={item.profiles?.avatar_url ?? null} size={28} />
					<div class="comment__body">
						<div class="comment__head">
							<a class="comment__author" href={resolve('/u/[username]', { username: item.profiles?.username ?? '' })}>
								@{item.profiles?.username}
							</a>
							<span class="small muted">{timeAgo(item.created_at)}</span>
							{#if item.author_id === session.user?.id}
								<button type="button" class="btn btn--quiet comment__drop" onclick={() => dropComment(item)}>
									Удалить
								</button>
							{/if}
						</div>
						<p class="comment__text">{item.body}</p>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
{/if}

<style>
	.comments {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.comment {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.75rem;
		padding-block: 0.875rem;
		border-bottom: 1px solid var(--border);
	}

	.comment__body {
		min-width: 0;
	}

	.comment__head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.375rem;
		font-size: 0.875rem;
	}

	.comment__author {
		font-weight: 600;
	}

	.comment__text {
		margin-block-start: 0.25rem;
		white-space: pre-wrap;
	}

	.comment__drop {
		min-height: 2rem;
		margin-inline-start: auto;
		padding-inline: 0.5rem;
		font-size: 0.8125rem;
	}

	.comments__guest,
	.comments__empty {
		padding-block: 1rem;
	}
</style>
