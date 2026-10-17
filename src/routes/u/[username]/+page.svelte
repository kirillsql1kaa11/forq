<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Avatar from '#lib/components/Avatar.svelte';
	import PostCard from '#lib/components/PostCard.svelte';
	import {
		deletePost,
		editPost,
		errorMessage,
		fetchProfile,
		fetchUserPosts,
		setLike
	} from '#lib/api';
	import { monthYear } from '#lib/format';
	import { PostList } from '#lib/posts.svelte';
	import { session } from '#lib/session.svelte';
	import type { FeedPost, Profile } from '#lib/types';

	let profile = $state<Profile | null>(null);
	let authorId: string | null = null;
	let loading = $state(true);
	let notFound = $state(false);
	let current: string | undefined = undefined;
	let currentUser: string | null | undefined = undefined;

	const list = new PostList((cursor) =>
		authorId ? fetchUserPosts(authorId, cursor) : Promise.resolve([])
	);

	$effect(() => {
		const name = page.params.username ?? '';
		const userId = session.user?.id ?? null;
		if (name === current && userId === currentUser) return;
		current = name;
		currentUser = userId;
		void load(name);
	});

	async function load(name: string) {
		loading = true;
		notFound = false;

		try {
			const found = await fetchProfile(name);

			if (!found) {
				profile = null;
				notFound = true;
				return;
			}

			profile = found;
			authorId = found.id;
			await list.load();
		} catch (cause) {
			list.error = errorMessage(cause);
		} finally {
			loading = false;
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

<svelte:head>
	<title>{profile ? `@${profile.username} — ForQ` : 'Профиль — ForQ'}</title>
</svelte:head>

{#if loading}
	<p class="muted">Загрузка…</p>
{:else if notFound || !profile}
	<h1>Профиль не найден</h1>
	<p class="muted">Пользователя с таким ником нет.</p>
{:else}
	<header class="profile">
		<Avatar username={profile.username} url={profile.avatar_url} size={64} />
		<div class="profile__info">
			<h1>@{profile.username}</h1>
			{#if profile.bio}
				<p class="profile__bio">{profile.bio}</p>
			{/if}
			<p class="small muted">С {monthYear(profile.created_at)}</p>

			{#if session.profile?.id === profile.id}
				<a class="btn btn--quiet profile__edit" href={resolve('/settings')}>Изменить профиль</a>
			{/if}
		</div>
	</header>

	{#if list.actionError}
		<p class="alert alert--error" role="alert">{list.actionError}</p>
	{/if}

	{#if list.loading}
		<p class="muted">Загрузка…</p>
	{:else if list.error}
		<p class="alert alert--error" role="alert">{list.error}</p>
	{:else if list.items.length === 0}
		<p class="muted">Постов пока нет.</p>
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
{/if}

<style>
	.profile {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding-block: 1rem 1.25rem;
		border-bottom: 1px solid var(--border);
	}

	.profile__info {
		display: grid;
		gap: 0.25rem;
		min-width: 0;
	}

	.profile__bio {
		white-space: pre-wrap;
	}

	.profile__edit {
		justify-self: start;
		margin-inline-start: -0.9rem;
	}

	.more {
		width: 100%;
		margin-block-start: 1rem;
	}
</style>
