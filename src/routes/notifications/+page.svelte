<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { errorMessage, fetchNotifications, markNotificationsRead } from '#lib/api';
	import Avatar from '#lib/components/Avatar.svelte';
	import { timeAgo } from '#lib/format';
	import { session } from '#lib/session.svelte';
	import { NOTIFICATION_PAGE_SIZE, NOTIFICATION_TEXT, type Notification } from '#lib/types';

	let items = $state<Notification[]>([]);
	let loading = $state(true);
	let loadingMore = $state(false);
	let exhausted = $state(false);
	let error = $state('');

	onMount(() => {
		if (session.user) void load();
		else loading = false;
	});

	async function load() {
		loading = true;
		error = '';

		try {
			items = await fetchNotifications();
			exhausted = items.length < NOTIFICATION_PAGE_SIZE;
			await markNotificationsRead();
			session.unread = 0;
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			loading = false;
		}
	}

	async function more() {
		const last = items.at(-1);
		if (loadingMore || exhausted || !last) return;

		loadingMore = true;

		try {
			const page = await fetchNotifications(last.id);
			items = [...items, ...page];
			exhausted = page.length < NOTIFICATION_PAGE_SIZE;
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			loadingMore = false;
		}
	}

	function excerpt(item: Notification): string {
		return item.comment_body ?? item.post_body ?? '';
	}

	function link(item: Notification): string {
		return item.post_id ? resolve('/p/[id]', { id: String(item.post_id) }) : resolve('/');
	}
</script>

<svelte:head>
	<title>Уведомления — ForQ</title>
</svelte:head>

<h1 class="notifications__title">Уведомления</h1>

{#if !session.user}
	<p class="muted notifications__empty">
		<a href={resolve('/login')}>Войди</a>, чтобы видеть уведомления.
	</p>
{:else if loading}
	<p class="muted notifications__empty">Загрузка…</p>
{:else if error}
	<p class="alert alert--error" role="alert">{error}</p>
{:else if items.length === 0}
	<p class="muted notifications__empty">Пока тихо.</p>
{:else}
	<ul class="notifications">
		{#each items as item (item.id)}
			<li class="notification" class:notification--new={item.read_at === null}>
				<a class="notification__avatar" href={resolve('/u/[username]', { username: item.actor_username })} tabindex="-1" aria-hidden="true">
					<Avatar username={item.actor_username} url={item.actor_avatar_url} size={32} />
				</a>

				<div class="notification__main">
					<p>
						<a class="notification__actor" href={resolve('/u/[username]', { username: item.actor_username })}>
							@{item.actor_username}
						</a>
						<span class="muted">{NOTIFICATION_TEXT[item.kind]}</span>
					</p>

					{#if excerpt(item)}
						<a class="notification__excerpt" href={link(item)}>{excerpt(item)}</a>
					{/if}

					<span class="small muted">{timeAgo(item.created_at)}</span>
				</div>
			</li>
		{/each}
	</ul>

	{#if !exhausted}
		<button type="button" class="btn notifications__more" onclick={more} disabled={loadingMore}>
			{loadingMore ? 'Загружаю…' : 'Показать ещё'}
		</button>
	{/if}
{/if}

<style>
	.notifications__title {
		padding-block-end: 0.75rem;
		border-bottom: 1px solid var(--border);
	}

	.notifications {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.notification {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.75rem;
		padding-block: 0.875rem;
		border-bottom: 1px solid var(--border);
	}

	.notification--new {
		box-shadow: inset 3px 0 0 var(--accent);
		padding-inline-start: 0.75rem;
	}

	.notification__avatar {
		text-decoration: none;
	}

	.notification__main {
		display: grid;
		gap: 0.125rem;
		min-width: 0;
		font-size: 0.9375rem;
	}

	.notification__actor {
		font-weight: 600;
	}

	.notification__excerpt {
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.notifications__empty {
		padding-block: 1.5rem;
	}

	.notifications__more {
		width: 100%;
		margin-block-start: 1rem;
	}
</style>
