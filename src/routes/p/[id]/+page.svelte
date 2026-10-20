<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		createComment,
		deleteComment,
		deletePost,
		editPost,
		errorMessage,
		fetchComment,
		fetchComments,
		fetchPost,
		fetchReplies,
		setLike,
		setPinnedPost
	} from '#lib/api';
	import { copyText } from '#lib/clipboard';
	import Avatar from '#lib/components/Avatar.svelte';
	import Composer from '#lib/components/Composer.svelte';
	import PostCard from '#lib/components/PostCard.svelte';
	import RichText from '#lib/components/RichText.svelte';
	import { timeAgo } from '#lib/format';
	import { session } from '#lib/session.svelte';
	import { COMMENT_PAGE_SIZE, type Comment, type FeedPost } from '#lib/types';

	let post = $state<FeedPost | null>(null);
	let comments = $state<Comment[]>([]);
	let replies = $state<Record<number, Comment[]>>({});
	let loading = $state(true);
	let loadingComments = $state(false);
	let commentsExhausted = $state(true);
	let notFound = $state(false);
	let actionError = $state('');
	let replyingTo = $state<number | null>(null);
	let currentId: number | undefined = undefined;
	let currentUser: string | null | undefined = undefined;
	let linked = $state<number | null>(null);
	let copiedId = $state<number | null>(null);
	let linkError = $state('');
	let copyTimer: ReturnType<typeof setTimeout> | undefined;
	let flashTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		const onHash = () => {
			if (post) void openHash(post.id);
		};

		window.addEventListener('hashchange', onHash);
		return () => window.removeEventListener('hashchange', onHash);
	});

	onDestroy(() => {
		clearTimeout(copyTimer);
		clearTimeout(flashTimer);
	});

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
		actionError = '';
		replyingTo = null;
		comments = [];
		replies = {};
		commentsExhausted = true;
		linked = null;
		copiedId = null;
		linkError = '';
		clearTimeout(copyTimer);
		clearTimeout(flashTimer);

		try {
			const found = await fetchPost(id);

			if (!found) {
				post = null;
				notFound = true;
				return;
			}

			post = found;
			await loadComments(id);
			await openHash(id);
		} catch (cause) {
			actionError = errorMessage(cause);
		} finally {
			loading = false;
		}
	}

	async function loadComments(id: number) {
		loadingComments = true;

		try {
			const batch = await fetchComments(id);
			comments = batch;
			commentsExhausted = batch.length < COMMENT_PAGE_SIZE;
			await loadReplies(id, batch);
		} catch (cause) {
			actionError = errorMessage(cause);
		} finally {
			loadingComments = false;
		}
	}

	async function moreComments() {
		const last = comments.at(-1);
		if (!post || loadingComments || commentsExhausted || !last) return;

		loadingComments = true;

		try {
			const batch = await fetchComments(post.id, last.id);
			const known = new Set(comments.map((item) => item.id));
			const added = batch.filter((item) => !known.has(item.id));

			comments = [...comments, ...added];
			commentsExhausted = batch.length < COMMENT_PAGE_SIZE;
			await loadReplies(post.id, added);
		} catch (cause) {
			actionError = errorMessage(cause);
		} finally {
			loadingComments = false;
		}
	}

	async function loadReplies(postId: number, parents: Comment[]) {
		const ids = parents.map((item) => item.id);
		if (ids.length === 0) return;

		const rows = await fetchReplies(postId, ids);
		const grouped: Record<number, Comment[]> = { ...replies };

		for (const row of rows) {
			const key = row.parent_id ?? 0;
			const current = grouped[key] ?? [];
			if (!current.some((item) => item.id === row.id)) grouped[key] = [...current, row];
		}

		replies = grouped;
	}

	function findReply(id: number): Comment | undefined {
		for (const list of Object.values(replies)) {
			const found = list.find((item) => item.id === id);
			if (found) return found;
		}

		return undefined;
	}

	function flash(id: number) {
		linked = id;
		clearTimeout(flashTimer);
		flashTimer = setTimeout(() => (linked = null), 2400);

		requestAnimationFrame(() => {
			document.getElementById(`c${id}`)?.scrollIntoView({ block: 'center' });
		});
	}

	async function openHash(postId: number) {
		const match = /^#c(\d+)$/.exec(location.hash);

		if (!match) {
			linkError = '';
			return;
		}

		const id = Number(match[1]);
		linkError = '';
		linked = null;
		clearTimeout(flashTimer);

		try {
			const known = comments.find((item) => item.id === id) ?? findReply(id);

			if (known) {
				flash(id);
				return;
			}

			const target = await fetchComment(id);

			if (!target || target.post_id !== postId) {
				linkError = 'Комментарий не найден или удалён.';
				return;
			}

			if (comments.some((item) => item.id === id) || findReply(id)) {
				flash(id);
				return;
			}

			const parentId = target.parent_id;

			if (parentId === null) {
				comments = [target, ...comments];
				const rows = await fetchReplies(postId, [target.id]);
				replies = { ...replies, [target.id]: rows };
			} else {
				const parent =
					comments.find((item) => item.id === parentId) ?? (await fetchComment(parentId));

				if (!parent || parent.post_id !== postId || parent.parent_id !== null) {
					linkError = 'Комментарий не найден или удалён.';
					return;
				}

				if (!comments.some((item) => item.id === parent.id)) {
					comments = [parent, ...comments];
				}

				const rows = await fetchReplies(postId, [parent.id]);
				const merged = [...(replies[parent.id] ?? [])];

				for (const row of rows) {
					if (!merged.some((item) => item.id === row.id)) merged.push(row);
				}

				if (!merged.some((item) => item.id === target.id)) merged.push(target);

				replies = { ...replies, [parent.id]: merged.sort((a, b) => a.id - b.id) };
			}

			flash(id);
		} catch (cause) {
			linkError = errorMessage(cause);
		}
	}

	async function copyComment(id: number) {
		if (!post) return;

		const href = new URL(resolve('/p/[id]', { id: String(post.id) }), location.origin).toString();
		const ok = await copyText(`${href}#c${id}`);
		if (!ok) return;

		copiedId = id;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copiedId = null), 2000);
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

	async function pin(target: FeedPost) {
		if (!session.user || !session.profile) return;
		const next = session.profile.pinned_post_id === target.id ? null : target.id;

		try {
			await setPinnedPost(session.user.id, next);
			await session.refreshProfile();
		} catch (cause) {
			actionError = errorMessage(cause);
		}
	}

	async function comment(body: string, parentId: number | null) {
		if (!session.user || !post) throw new Error('Нужно войти в аккаунт.');

		const created = await createComment(post.id, session.user.id, body, parentId);

		post = { ...post, comment_count: post.comment_count + 1 };

		if (parentId === null) {
			comments = [created, ...comments];
		} else {
			replies = { ...replies, [parentId]: [...(replies[parentId] ?? []), created] };
		}

		replyingTo = null;
	}

	async function dropComment(target: Comment) {
		try {
			await deleteComment(target.id);

			if (target.parent_id === null) {
				const removed = 1 + (replies[target.id]?.length ?? 0);
				const rest = { ...replies };
				delete rest[target.id];
				replies = rest;
				comments = comments.filter((item) => item.id !== target.id);

				if (post) post = { ...post, comment_count: Math.max(0, post.comment_count - removed) };
			} else {
				replies = {
					...replies,
					[target.parent_id]: (replies[target.parent_id] ?? []).filter(
						(item) => item.id !== target.id
					)
				};

				if (post) post = { ...post, comment_count: Math.max(0, post.comment_count - 1) };
			}
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
		pinned={session.profile?.pinned_post_id === post.id}
		onlike={like}
		onedit={save}
		onremove={remove}
		onpin={pin}
	/>

	{#if actionError}
		<p class="alert alert--error" role="alert">{actionError}</p>
	{/if}

	{#if linkError}
		<p class="alert alert--error" role="alert">{linkError}</p>
	{/if}

	{#if session.user}
		<Composer placeholder="Ответить…" submitLabel="Ответить" onsubmit={(body) => comment(body, null)} />
	{:else}
		<p class="muted comments__guest">
			<a href={resolve('/login')}>Войди</a>, чтобы ответить.
		</p>
	{/if}

	{#if comments.length === 0 && !loadingComments}
		<p class="muted comments__guest">Ответов пока нет.</p>
	{:else}
		<ul class="comments">
			{#each comments as item (item.id)}
				<li class="comment" class:comment--linked={linked === item.id} id="c{item.id}">
					<Avatar
						username={item.profiles?.username ?? '?'}
						url={item.profiles?.avatar_url ?? null}
						size={28}
					/>

					<div class="comment__body">
						<div class="comment__head">
							<a
								class="comment__author"
								href={resolve('/u/[username]', { username: item.profiles?.username ?? '' })}
							>
								@{item.profiles?.username}
							</a>
							<span class="small muted">{timeAgo(item.created_at)}</span>

							<button
								type="button"
								class="btn btn--quiet comment__action"
								title="Ссылка на комментарий"
								aria-label="Скопировать ссылку на комментарий"
								onclick={() => copyComment(item.id)}
							>
								{copiedId === item.id ? 'Скопировано' : 'Ссылка'}
							</button>

							{#if session.user}
								<button
									type="button"
									class="btn btn--quiet comment__action"
									onclick={() => (replyingTo = replyingTo === item.id ? null : item.id)}
								>
									{replyingTo === item.id ? 'Отмена' : 'Ответить'}
								</button>
							{/if}

							{#if item.author_id === session.user?.id}
								<button
									type="button"
									class="btn btn--quiet comment__action"
									onclick={() => dropComment(item)}
								>
									Удалить
								</button>
							{/if}
						</div>

						<div class="comment__text">
							<RichText body={item.body} />
						</div>

						{#if replyingTo === item.id}
							<Composer
								placeholder="Ответить @{item.profiles?.username}"
								submitLabel="Ответить"
								autofocus
								onsubmit={(body) => comment(body, item.id)}
							/>
						{/if}

						{#if replies[item.id]?.length}
							<ul class="replies">
								{#each replies[item.id] as reply (reply.id)}
									<li
										class="comment comment--reply"
										class:comment--linked={linked === reply.id}
										id="c{reply.id}"
									>
										<Avatar
											username={reply.profiles?.username ?? '?'}
											url={reply.profiles?.avatar_url ?? null}
											size={24}
										/>

										<div class="comment__body">
											<div class="comment__head">
												<a
													class="comment__author"
													href={resolve('/u/[username]', {
														username: reply.profiles?.username ?? ''
													})}
												>
													@{reply.profiles?.username}
												</a>
												<span class="small muted">{timeAgo(reply.created_at)}</span>

												<button
													type="button"
													class="btn btn--quiet comment__action"
													title="Ссылка на комментарий"
													aria-label="Скопировать ссылку на комментарий"
													onclick={() => copyComment(reply.id)}
												>
													{copiedId === reply.id ? 'Скопировано' : 'Ссылка'}
												</button>

												{#if reply.author_id === session.user?.id}
													<button
														type="button"
														class="btn btn--quiet comment__action"
														onclick={() => dropComment(reply)}
													>
														Удалить
													</button>
												{/if}
											</div>

											<div class="comment__text">
												<RichText body={reply.body} />
											</div>
										</div>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</li>
			{/each}
		</ul>

		{#if comments.length > 0 && !commentsExhausted}
			<button
				type="button"
				class="btn comments__more"
				onclick={moreComments}
				disabled={loadingComments}
			>
				{loadingComments ? 'Загружаю…' : 'Показать ещё'}
			</button>
		{/if}
	{/if}

	<span class="sr-only" role="status">
		{copiedId ? 'Ссылка на комментарий скопирована' : ''}
	</span>
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
		scroll-margin-top: 6.5rem;
		transition:
			background-color 200ms ease,
			box-shadow 200ms ease;
	}

	.comment--linked {
		border-radius: 8px;
		background: color-mix(in srgb, var(--accent) 8%, transparent);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 8%, transparent);
	}

	.comment--reply {
		border-bottom: 0;
		padding-block: 0.625rem;
	}

	.replies {
		list-style: none;
		margin: 0;
		padding: 0;
		border-inline-start: 2px solid var(--border);
		padding-inline-start: 0.75rem;
		margin-block-start: 0.5rem;
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
	}

	.comment__action {
		min-height: 2rem;
		padding-inline: 0.5rem;
		font-size: 0.8125rem;
	}

	.comment__head > .comment__action:last-child {
		margin-inline-start: auto;
	}

	.comments__guest {
		padding-block: 1rem;
	}

	.comments__more {
		width: 100%;
		margin-block-start: 1rem;
	}
</style>
