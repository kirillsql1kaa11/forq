<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		errorMessage,
		fetchFollowCounts,
		fetchLikedPosts,
		fetchPost,
		fetchProfile,
		fetchUserPosts,
		fetchUserReplies,
		isFollowing,
		setFollow,
		setPinnedPost
	} from '#lib/api';
	import Avatar from '#lib/components/Avatar.svelte';
	import PostFeed from '#lib/components/PostFeed.svelte';
	import RichText from '#lib/components/RichText.svelte';
	import { monthYear, plural, timeAgo } from '#lib/format';
	import { PostList } from '#lib/posts.svelte';
	import { session } from '#lib/session.svelte';
	import {
		PAGE_SIZE,
		PROFILE_TABS,
		PROFILE_TAB_TEXT,
		type FeedPost,
		type FollowCounts,
		type Profile,
		type ProfileTab,
		type UserReply
	} from '#lib/types';

	let profile = $state<Profile | null>(null);
	let authorId = $state<string | null>(null);
	let loadingProfile = $state(true);
	let notFound = $state(false);
	let actionError = $state('');
	let replies = $state<UserReply[]>([]);
	let repliesLoading = $state(false);
	let repliesExhausted = $state(true);
	let repliesError = $state('');
	let current: string | undefined = undefined;
	let tabKey: string | undefined = undefined;
	let following = $state(false);
	let followBusy = $state(false);
	let counts = $state<FollowCounts | null>(null);

	const posts = new PostList((cursor) =>
		authorId ? fetchUserPosts(authorId, cursor) : Promise.resolve([])
	);

	const liked = new PostList((cursor) =>
		authorId ? fetchLikedPosts(authorId, cursor) : Promise.resolve([])
	);

	const pinnedList = new PostList(() => Promise.resolve([]));

	const tab = $derived(toTab(page.url.searchParams.get('tab')));
	const mine = $derived(profile !== null && session.profile?.id === profile.id);

	function toTab(value: string | null): ProfileTab {
		return PROFILE_TABS.includes(value as ProfileTab) ? (value as ProfileTab) : 'posts';
	}

	function tabHref(item: ProfileTab): string {
		const path = resolve('/u/[username]', { username: profile?.username ?? '' });
		return item === 'posts' ? path : `${path}?tab=${item}`;
	}

	$effect(() => {
		const name = page.params.username ?? '';
		const userId = session.user?.id ?? null;
		const key = `${name}|${userId ?? ''}`;
		if (key === current) return;
		current = key;
		void loadProfile(name);
	});

	$effect(() => {
		const id = authorId;
		const active = tab;
		const userId = session.user?.id ?? null;
		const key = `${id ?? ''}|${active}|${userId ?? ''}`;
		if (key === tabKey || id === null) return;
		tabKey = key;
		void loadTab(id, active);
	});

	async function loadProfile(name: string) {
		loadingProfile = true;
		notFound = false;
		actionError = '';
		profile = null;
		authorId = null;
		following = false;
		counts = null;
		replies = [];
		repliesError = '';
		repliesExhausted = true;
		posts.reset();
		liked.reset();
		pinnedList.fill([]);

		try {
			const found = await fetchProfile(name);

			if (!found) {
				notFound = true;
				return;
			}

			if (found.pinned_post_id !== null) {
				const candidate = await fetchPost(found.pinned_post_id);
				pinnedList.fill(candidate && candidate.author_id === found.id ? [candidate] : []);
			}

			profile = found;
			authorId = found.id;

			try {
				counts = await fetchFollowCounts(found.id);
			} catch {
				counts = null;
			}

			if (session.user && session.user.id !== found.id) {
				try {
					following = await isFollowing(session.user.id, found.id);
				} catch {
					following = false;
				}
			}
		} catch (cause) {
			actionError = errorMessage(cause);
		} finally {
			loadingProfile = false;
		}
	}

	async function loadTab(id: string, active: ProfileTab) {
		actionError = '';

		if (active === 'posts') {
			await posts.load();
			return;
		}

		if (active === 'likes') {
			await liked.load();
			return;
		}

		replies = [];
		repliesExhausted = true;
		await loadReplies(id);
	}

	async function loadReplies(id: string) {
		repliesLoading = true;
		repliesError = '';

		try {
			const batch = await fetchUserReplies(id);
			replies = batch;
			repliesExhausted = batch.length < PAGE_SIZE;
		} catch (cause) {
			repliesError = errorMessage(cause);
		} finally {
			repliesLoading = false;
		}
	}

	async function moreReplies() {
		const last = replies.at(-1);
		if (!authorId || last === undefined || repliesLoading || repliesExhausted) return;

		repliesLoading = true;

		try {
			const batch = await fetchUserReplies(authorId, last.id);
			replies = [...replies, ...batch];
			repliesExhausted = batch.length < PAGE_SIZE;
		} catch (cause) {
			repliesError = errorMessage(cause);
		} finally {
			repliesLoading = false;
		}
	}

	async function pinPost(post: FeedPost) {
		if (!session.user || !profile) return;
		const next = profile.pinned_post_id === post.id ? null : post.id;

		try {
			await setPinnedPost(session.user.id, next);
			profile = { ...profile, pinned_post_id: next };
			pinnedList.fill(next === null ? [] : [post]);
			await session.refreshProfile();
		} catch (cause) {
			actionError = errorMessage(cause);
		}
	}

	async function toggleFollow() {
		const user = session.user;
		if (!user || !profile || followBusy) return;

		const next = !following;
		followBusy = true;
		actionError = '';

		try {
			await setFollow(user.id, profile.id, next);
			following = next;

			if (counts) {
				counts = {
					...counts,
					followers: Math.max(0, counts.followers + (next ? 1 : -1))
				};
			}
		} catch (cause) {
			actionError = errorMessage(cause);
		} finally {
			followBusy = false;
		}
	}
</script>

<svelte:head>
	<title>{profile ? `@${profile.username} — ForQ` : 'Профиль — ForQ'}</title>
</svelte:head>

{#if loadingProfile}
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

			{#if counts}
				<p class="profile__counts small">
					<a
						class="profile__count"
						href={resolve('/u/[username]/followers', { username: profile.username })}
					>
						<strong>{counts.followers}</strong>
						{plural(counts.followers, 'подписчик', 'подписчика', 'подписчиков')}
					</a>
					<span class="muted" aria-hidden="true">·</span>
					<a
						class="profile__count"
						href={resolve('/u/[username]/following', { username: profile.username })}
					>
						<strong>{counts.following}</strong>
						{plural(counts.following, 'подписка', 'подписки', 'подписок')}
					</a>
				</p>
			{/if}

			<p class="small muted">С {monthYear(profile.created_at)}</p>

			{#if mine}
				<div class="profile__actions">
					<a class="btn btn--quiet" href={resolve('/settings')}>Изменить профиль</a>
				</div>
			{:else if session.user}
				<div class="profile__actions">
					<button
						type="button"
						class="btn"
						class:btn--primary={!following}
						onclick={toggleFollow}
						disabled={followBusy}
					>
						{following ? 'Отписаться' : 'Подписаться'}
					</button>
				</div>
			{/if}
		</div>
	</header>

	<nav class="tabs" aria-label="Разделы профиля">
		{#each PROFILE_TABS as item (item)}
			<a
				class="tabs__tab"
				class:tabs__tab--on={item === tab}
				aria-current={item === tab ? 'page' : undefined}
				href={tabHref(item)}
			>
				{PROFILE_TAB_TEXT[item]}
			</a>
		{/each}
	</nav>

	{#if actionError}
		<p class="alert alert--error" role="alert">{actionError}</p>
	{/if}

	{#if tab === 'posts'}
		{#if pinnedList.items.length > 0}
			<PostFeed
				list={pinnedList}
				onpin={pinPost}
				pinnedId={profile.pinned_post_id}
			/>
		{/if}

		<PostFeed
			list={posts}
			empty="Постов пока нет."
			exclude={profile.pinned_post_id}
			pinnedId={profile.pinned_post_id}
			onpin={pinPost}
		/>
	{:else if tab === 'likes'}
		<PostFeed list={liked} empty="Отметок «нравится» пока нет." onpin={pinPost} pinnedId={profile.pinned_post_id} />
	{:else if repliesLoading && replies.length === 0}
		<p class="muted">Загрузка…</p>
	{:else if repliesError}
		<p class="alert alert--error" role="alert">{repliesError}</p>
	{:else if replies.length === 0}
		<p class="muted">Ответов пока нет.</p>
	{:else}
		<ul class="replies">
			{#each replies as item (item.id)}
				<li class="replies__item">
					<p class="small muted">
						{timeAgo(item.created_at)}
						{#if item.parent_id !== null}
							· ответ на комментарий
						{/if}
					</p>

					<div class="replies__body">
						<RichText body={item.body} />
					</div>

					{#if item.posts && item.posts.deleted_at === null}
						<a
							class="replies__quote"
							href={resolve('/p/[id]', { id: String(item.post_id) })}
						>
							{item.posts.body}
						</a>
					{:else}
						<p class="replies__quote replies__quote--gone">Пост удалён</p>
					{/if}
				</li>
			{/each}
		</ul>

		{#if !repliesExhausted}
			<button type="button" class="btn replies__more" onclick={moreReplies} disabled={repliesLoading}>
				{repliesLoading ? 'Загружаю…' : 'Показать ещё'}
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
	}

	.profile__info {
		display: grid;
		gap: 0.25rem;
		min-width: 0;
	}

	.profile__bio {
		white-space: pre-wrap;
	}

	.profile__counts {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 0.5rem;
		margin-block-start: 0.125rem;
	}

	.profile__count {
		display: inline-flex;
		align-items: baseline;
		gap: 0.25rem;
	}

	.profile__count strong {
		color: var(--fg);
		font-weight: 600;
	}

	.profile__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-block-start: 0.5rem;
		margin-inline-start: -0.9rem;
	}

	.tabs {
		margin-block-end: 0.75rem;
	}

	.replies {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.replies__item {
		padding-block: 1rem;
		border-bottom: 1px solid var(--border);
	}

	.replies__body {
		margin-block-start: 0.125rem;
	}

	.replies__quote {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		margin-block-start: 0.5rem;
		padding-inline-start: 0.75rem;
		border-inline-start: 2px solid var(--border);
		color: var(--muted);
		font-size: 0.875rem;
	}

	.replies__quote--gone {
		font-style: italic;
	}

	.replies__more {
		width: 100%;
		margin-block-start: 1rem;
	}
</style>
