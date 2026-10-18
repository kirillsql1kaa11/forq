<script lang="ts">
	import { page } from '$app/state';
	import PeopleList from '#lib/components/PeopleList.svelte';

	const username = $derived(page.params.username ?? '');
</script>

{#if username}
	<PeopleList {username} mode="followers" />
{/if}
