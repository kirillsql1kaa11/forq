<script lang="ts">
	import { resolve } from '$app/paths';
	import { errorMessage, fetchFollowPeople, fetchProfile } from '#lib/api';
	import { PEOPLE_PAGE_SIZE, PEOPLE_TAB_TEXT, type FollowPerson, type PeopleTab, type Profile } from '#lib/types';
	import Avatar from './Avatar.svelte';

	let { username, mode }: { username: string; mode: PeopleTab } = $props();

	let profile = $state<Profile | null>(null);
	let people = $state<FollowPerson[]>([]);
	let loading = $state(true);
	let loadingMore = $state(false);
	let exhausted = $state(true);
	let notFound = $state(false);
	let error = $state('');
	let current = '';

	const title = $derived(PEOPLE_TAB_TEXT[mode]);
	const empty = $derived(mode === 'followers' ? 'Подписчиков пока нет.' : 'Подписок пока нет.');

	$effect(() => {
		const key = `${username}|${mode}`;
		if (key === current) return;
		current = key;
		void load();
	});

	async function load() {
		loading = true;
		error = '';
		notFound = false;
		people = [];
		profile = null;
		exhausted = true;

		try {
			const found = await fetchProfile(username);

			if (!found) {
				notFound = true;
				return;
			}

			profile = found;
			await loadPage(found.id, 0);
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			loading = false;
		}
	}

	async function loadPage(id: string, offset: number) {
		const batch = await fetchFollowPeople(id, mode, offset);
		people = offset === 0 ? batch : [...people, ...batch];
		exhausted = batch.length < PEOPLE_PAGE_SIZE;
	}

	async function more() {
		if (!profile || loadingMore || exhausted) return;

		loadingMore = true;
		error = '';

		try {
			await loadPage(profile.id, people.length);
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			loadingMore = false;
		}
	}
</script>

<svelte:head>
	<title>{profile ? `${title} @${profile.username} — ForQ` : `${title} — ForQ`}</title>
</svelte:head>

{#if loading}
	<p class="muted">Загрузка…</p>
{:else if notFound || !profile}
	<h1>Профиль не найден</h1>
	<p class="muted">Пользователя с таким ником нет.</p>
{:else}
	<header class="people__head">
		<a class="btn btn--quiet people__back" href={resolve('/u/[username]', { username: profile.username })}>
			← @{profile.username}
		</a>
		<h1>{title}</h1>
	</header>

	{#if error}
		<p class="alert alert--error" role="alert">{error}</p>
	{/if}

	{#if people.length === 0}
		<p class="muted people__empty">{empty}</p>
	{:else}
		<ul class="people">
			{#each people as person (person.username)}
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
				</li>
			{/each}
		</ul>

		{#if !exhausted}
			<button type="button" class="btn people__more" onclick={more} disabled={loadingMore}>
				{loadingMore ? 'Загружаю…' : 'Показать ещё'}
			</button>
		{/if}
	{/if}
{/if}

<style>
	.people__head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-block: 0.5rem 1rem;
	}

	.people__back {
		min-height: 2.25rem;
		margin-inline-start: -0.7rem;
		padding-inline: 0.7rem;
		font-size: 0.875rem;
	}

	.people {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.people__item {
		border-bottom: 1px solid var(--border);
	}

	.people__link {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding-block: 0.75rem;
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

	.people__empty {
		padding-block: 1rem;
	}

	.people__more {
		width: 100%;
		margin-block-start: 1rem;
	}
</style>
