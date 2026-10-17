<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { searchPosts } from '#lib/api';
	import PostFeed from '#lib/components/PostFeed.svelte';
	import { PostList } from '#lib/posts.svelte';
	import { SEARCH_MIN } from '#lib/types';

	let field = $state('');
	let current: string | undefined = undefined;

	const query = $derived((page.url.searchParams.get('q') ?? '').trim());
	const ready = $derived(query.length >= SEARCH_MIN);
	const results = new PostList((cursor) => searchPosts(query, cursor));

	$effect(() => {
		const term = query;
		field = term;
		if (term === current) return;
		current = term;

		if (term.length < SEARCH_MIN) {
			results.fill([]);
			return;
		}

		void results.load();
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const term = field.trim();
		const path = resolve('/search');

		void goto(term.length === 0 ? path : `${path}?q=${encodeURIComponent(term)}`);
	}
</script>

<svelte:head>
	<title>{ready ? `${query} — поиск — ForQ` : 'Поиск — ForQ'}</title>
</svelte:head>

<h1>Поиск</h1>

<form class="search" onsubmit={submit}>
	<label class="sr-only" for="search-term">Слова из постов</label>
	<input
		id="search-term"
		class="field__input"
		type="search"
		bind:value={field}
		placeholder="Слова из постов"
		autocomplete="off"
		autocapitalize="off"
		spellcheck="false"
	/>
	<button type="submit" class="btn btn--primary">Найти</button>
</form>

<PostFeed
	list={results}
	empty={ready ? 'Ничего не нашлось.' : `Введи хотя бы ${SEARCH_MIN} символа.`}
/>

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
</style>
