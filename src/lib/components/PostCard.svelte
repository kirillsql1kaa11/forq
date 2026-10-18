<script lang="ts">
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import { copyText } from '#lib/clipboard';
	import { fullDate, timeAgo } from '#lib/format';
	import { applyMarkup } from '#lib/markup';
	import { BODY_MAX, type FeedPost } from '#lib/types';
	import Avatar from './Avatar.svelte';
	import MarkupTools from './MarkupTools.svelte';
	import RichText from './RichText.svelte';

	let {
		post,
		currentUserId = null,
		pinned = false,
		onlike,
		onedit,
		onremove,
		onpin
	}: {
		post: FeedPost;
		currentUserId?: string | null;
		pinned?: boolean;
		onlike: (post: FeedPost) => void;
		onedit: (post: FeedPost, body: string) => void;
		onremove: (post: FeedPost) => void;
		onpin?: (post: FeedPost) => void;
	} = $props();

	let editing = $state(false);
	let draft = $state('');
	let confirming = $state(false);
	let copied = $state(false);
	let editor = $state<HTMLTextAreaElement | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const mine = $derived(currentUserId !== null && currentUserId === post.author_id);

	function startEdit() {
		draft = post.body;
		editing = true;
	}

	function save(event: SubmitEvent) {
		event.preventDefault();
		const next = draft.trim();
		editing = false;
		if (next && next !== post.body) onedit(post, next);
	}

	function format(mark: string) {
		if (!editor) return;

		const start = editor.selectionStart ?? draft.length;
		const end = editor.selectionEnd ?? start;
		const result = applyMarkup(draft, start, end, mark, BODY_MAX);
		if (!result) return;

		draft = result.value;

		void Promise.resolve().then(() => {
			editor?.focus();
			editor?.setSelectionRange(result.start, result.end);
		});
	}

	async function copyLink() {
		const url = new URL(resolve('/p/[id]', { id: String(post.id) }), location.origin).toString();
		const ok = await copyText(url);
		if (!ok) return;

		copied = true;
		clearTimeout(timer);
		timer = setTimeout(() => (copied = false), 2000);
	}

	onDestroy(() => clearTimeout(timer));
</script>

<article class="post">
	<a class="post__avatar" href={resolve('/u/[username]', { username: post.username })} tabindex="-1" aria-hidden="true">
		<Avatar username={post.username} url={post.avatar_url} />
	</a>

	<div class="post__main">
		<div class="post__head">
			<a class="post__author" href={resolve('/u/[username]', { username: post.username })}>@{post.username}</a>
			{#if post.pending}
				<span class="post__time">отправляется…</span>
			{:else}
				<a class="post__time" href={resolve('/p/[id]', { id: String(post.id) })} title={fullDate(post.created_at)}>
					{timeAgo(post.created_at)}
				</a>
				{#if post.edited_at}
					<span class="post__edited">изменён</span>
				{/if}
				{#if pinned}
					<span class="post__pinned">закреплён</span>
				{/if}
			{/if}
		</div>

		{#if editing}
			<form onsubmit={save}>
				<label class="sr-only" for="edit-{post.id}">Изменить пост</label>

				<MarkupTools onformat={format} />

				<textarea
					id="edit-{post.id}"
					bind:this={editor}
					class="field__input post__editor"
					bind:value={draft}
					maxlength={BODY_MAX}
				></textarea>
				<div class="row">
					<button type="button" class="btn btn--quiet" onclick={() => (editing = false)}>Отмена</button>
					<button type="submit" class="btn btn--primary" disabled={!draft.trim() || draft.trim() === post.body}>
						Сохранить
					</button>
				</div>
			</form>
		{:else}
			<div class="post__text">
				<RichText body={post.body} />
			</div>
		{/if}

		{#if !editing && !post.pending}
			<div class="post__actions">
				<button
					type="button"
					class="btn btn--quiet post__action"
					class:post__action--on={post.liked_by_me}
					onclick={() => onlike(post)}
					aria-pressed={post.liked_by_me}
					aria-label={post.liked_by_me ? 'Убрать отметку «нравится»' : 'Нравится'}
				>
					<svg viewBox="0 0 24 24" width="16" height="16" fill={post.liked_by_me ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.6" aria-hidden="true">
						<path d="M12 20s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.6 12 20 12 20Z" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
					<span>{post.like_count}</span>
				</button>

				<a class="btn btn--quiet post__action" href={resolve('/p/[id]', { id: String(post.id) })} aria-label="Комментарии: {post.comment_count}">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
						<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
					<span>{post.comment_count}</span>
				</a>

				<button
					type="button"
					class="btn btn--quiet post__action"
					class:post__action--on={copied}
					onclick={copyLink}
					aria-label="Скопировать ссылку на пост"
				>
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
						<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7" stroke-linecap="round" stroke-linejoin="round" />
						<path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
					<span>{copied ? 'Скопировано' : 'Ссылка'}</span>
				</button>

				<span class="sr-only" role="status">{copied ? 'Ссылка скопирована' : ''}</span>

				{#if mine}
					{#if onpin}
						<button
							type="button"
							class="btn btn--quiet post__action"
							onclick={() => onpin(post)}
							aria-pressed={pinned}
						>
							{pinned ? 'Открепить' : 'Закрепить'}
						</button>
					{/if}

					{#if confirming}
						<button type="button" class="btn btn--quiet post__action post__action--danger" onclick={() => onremove(post)}>
							Удалить?
						</button>
						<button type="button" class="btn btn--quiet post__action" onclick={() => (confirming = false)}>
							Отмена
						</button>
					{:else}
						<button type="button" class="btn btn--quiet post__action" onclick={startEdit}>Изменить</button>
						<button type="button" class="btn btn--quiet post__action" onclick={() => (confirming = true)}>
							Удалить
						</button>
					{/if}
				{/if}
			</div>
		{/if}
	</div>
</article>

<style>
	.post {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.75rem;
		padding-block: 1rem;
		border-bottom: 1px solid var(--border);
	}

	.post__avatar {
		text-decoration: none;
	}

	.post__main {
		min-width: 0;
	}

	.post__head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.375rem;
		font-size: 0.875rem;
	}

	.post__author {
		font-weight: 600;
	}

	.post__time,
	.post__edited,
	.post__pinned {
		color: var(--muted);
		font-size: 0.8125rem;
	}

	.post__text {
		margin-block: 0.125rem 0.375rem;
	}

	.post__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
		margin-inline-start: -0.7rem;
	}

	.post__action {
		min-height: 2.5rem;
		padding-inline: 0.7rem;
		font-size: 0.8125rem;
		color: var(--muted);
		text-decoration: none;
	}

	.post__action:hover {
		text-decoration: none;
	}

	.post__action--on {
		color: var(--accent);
	}

	.post__action--danger {
		color: var(--danger);
	}

	.row {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-block-start: 0.5rem;
	}

	.post__editor {
		margin-block-start: 0.5rem;
	}
</style>
