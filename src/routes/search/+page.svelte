<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { errorMessage, searchPeople, searchPosts, setFollow } from '#lib/api';
	import Avatar from '#lib/components/Avatar.svelte';
	import PostFeed from '#lib/components/PostFeed.svelte';
	import { PostList } from '#lib/posts.svelte';
	import { session } from '#lib/session.svelte';
	import { SEARCH_MIN, type PersonResult } from '#lib/types';

	const TABS = ['posts', 'people'] as const;
	type SearchTab = (typeof TABS)[number];

	const TAB_TEXT: Record<SearchTab, string> = {
		posts: 'Посты',
		people: 'Люди'
	};

	let field = $state('');
	let current: string | undefined = undefined;
	let people = $state<PersonResult[]>([]);
	let peopleLoading = $state(false);
	let peopleError = $state('');
	let peopleKey = '';
	let followBusy = $state<string | null>(null);

	const query = $derived((page.url.searchParams.get('q') ?? '').trim());
	const tab = $derived(toTab(page.url.searchParams.get('tab')));
	const ready = $derived(query.length >= SEARCH_MIN);
	const results = new PostList((cursor) => searchPosts(query, cursor));

	function toTab(value: string | null): SearchTab {
		return value === 'people' ? 'people' : 'posts';
	}

	$effect(() => {
		const term = query;
		const active = tab;
		field = term;
		const key = `${term}|${active}`;
		if (key === current) return;
		current = key;

		if (term.length < SEARCH_MIN || active !== 'posts') {
			results.fill([]);
			return;
		}

		void results.load();
	});

	$effect(() => {
		const term = query;
		const active = tab;
		const viewer = session.user?.id ?? null;

		if (active !== 'people' || term.length < SEARCH_MIN) {
			people = [];
			peopleError = '';
			peopleLoading = false;
			peopleKey = '';
			return;
		}

		const key = `${term}|${viewer ?? ''}`;
		if (key === peopleKey) return;
		peopleKey = key;
		void loadPeople(term, viewer, key);
	});

	async function loadPeople(term: string, viewer: string | null, key: string) {
		peopleLoading = true;
		peopleError = '';
		people = [];

		try {
			const rows = await searchPeople(term, viewer);
			if (peopleKey === key) people = rows;
		} catch (cause) {
			if (peopleKey === key) peopleError = errorMessage(cause);
		} finally {
			if (peopleKey === key) peopleLoading = false;
		}
	}

	async function toggleFollow(person: PersonResult) {
		const user = session.user;
		if (!user || followBusy) return;

		const next = !person.following;
		followBusy = person.id;
		peopleError = '';
		people = people.map((item) => (item.id === person.id ? { ...item, following: next } : item));

		try {
			await setFollow(user.id, person.id, next);
		} catch (cause) {
			people = people.map((item) =>
				item.id === person.id ? { ...item, following: !next } : item
			);
			peopleError = errorMessage(cause);
		} finally {
			followBusy = null;
		}
	}

	function tabHref(item: SearchTab): string {
		const params = new URLSearchParams();
		const term = field.trim();
		const path = resolve('/search');

		if (term) params.set('q', term);
		if (item === 'people') params.set('tab', 'people');

		const suffix = params.toString();
		return suffix ? `${path}?${suffix}` : path;
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const term = field.trim();
		const params = new URLSearchParams();
		const path = resolve('/search');

		if (term) params.set('q', term);
		if (tab === 'people') params.set('tab', 'people');

		const suffix = params.toString();
		void goto(suffix ? `${path}?${suffix}` : path);
	}
</script>

<svelte:head>
	<title>{ready ? `${query} — поиск — ForQ` : 'Поиск — ForQ'}</title>
</svelte:head>

<h1>Поиск</h1>

<form class="search" onsubmit={submit}>
	<label class="sr-only" for="search-term">
		{tab === 'people' ? 'Ник или описание профиля' : 'Слова из постов'}
	</label>
	<input
		id="search-term"
		class="field__input"
		type="search"
		bind:value={field}
		placeholder={tab === 'people' ? 'Ник или описание' : 'Слова из постов'}
		autocomplete="off"
		autocapitalize="off"
		spellcheck="false"
	/>
	<button type="submit" class="btn btn--primary">Найти</button>
</form>

<nav class="tabs search__tabs" aria-label="Что искать">
	{#each TABS as item (item)}
		<a
			class="tabs__tab"
			class:tabs__tab--on={tab === item}
			aria-current={tab === item ? 'page' : undefined}
			href={tabHref(item)}
		>
			{TAB_TEXT[item]}
		</a>
	{/each}
</nav>

{#if tab === 'people' && !session.user}
	<p class="small muted search__hint">
		<a href={resolve('/login')}>Войди</a>, чтобы подписываться на людей.
	</p>
{/if}

{#if tab === 'posts'}
	<PostFeed
		list={results}
		empty={ready ? 'Ничего не нашлось.' : `Введи хотя бы ${SEARCH_MIN} символа.`}
	/>
{:else if peopleError}
	<p class="alert alert--error" role="alert">{peopleError}</p>
{:else if peopleLoading}
	<p class="muted people__empty">Загрузка…</p>
{:else if !ready}
	<p class="muted people__empty">Введи хотя бы {SEARCH_MIN} символа.</p>
{:else if people.length === 0}
	<p class="muted people__empty">Никого не нашлось.</p>
{:else}
	<ul class="people">
		{#each people as person (person.id)}
			<li class="people__item">
				<a class="people__link" href={resolve('/u/[username]', { username: person.username })}>
					<Avatar username={person.username} url={person.avatar_url} size={40} />
					<span class="people__text">
						<span class="people__name">@{person.username}</span>
						{#if person.bio}
							<span class="people__bio">{person.bio}</span>
						{/if}
					</span>
				</a>

				{#if session.user && session.user.id !== person.id}
					<button
						type="button"
						class="btn people__follow"
						class:btn--primary={!person.following}
						disabled={followBusy !== null}
						aria-busy={followBusy === person.id}
						onclick={() => toggleFollow(person)}
					>
						{followBusy === person.id ? '…' : person.following ? 'Отписаться' : 'Подписаться'}
					</button>
				{:else if session.user}
					<span class="small muted people__you">это ты</span>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.search {
		display: flex;
		gap: 0.5rem;
		margin-block: 0.75rem;
	}

	.search > .field__input {
		flex: 1;
		min-width: 0;
	}

	.search__tabs {
		margin-block-end: 0.75rem;
	}

	.search__hint {
		margin-block-end: 0.75rem;
	}

	.people {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.people__item {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		padding-block: 0.75rem;
		border-bottom: 1px solid var(--border);
	}

	.people__link {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.people__link:hover {
		text-decoration: none;
	}

	.people__link:hover .people__name {
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.people__text {
		display: grid;
		gap: 0.125rem;
		min-width: 0;
	}

	.people__name {
		font-weight: 600;
		font-size: 0.9375rem;
	}

	.people__bio {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		color: var(--muted);
		font-size: 0.875rem;
	}

	.people__follow {
		flex: none;
		min-height: 2.25rem;
		padding-inline: 0.7rem;
		font-size: 0.8125rem;
		white-space: nowrap;
	}

	.people__you {
		white-space: nowrap;
	}

	.people__empty {
		padding-block: 1rem;
	}
</style>
