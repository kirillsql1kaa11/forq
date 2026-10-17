<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { dev } from '$app/env';
	import { goto } from '$app/navigation';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';
	import { session } from '#lib/session.svelte';
	import { configMissing, supabase } from '#lib/supabase';
	import '../app.css';

	let { children }: { children: Snippet } = $props();

	let observedUser: string | null | undefined = undefined;

	onMount(() => {
		if (!configMissing) void session.start();

		if (!dev && 'serviceWorker' in navigator) {
			void navigator.serviceWorker.register(asset('sw.js'));
		}
	});

	$effect(() => {
		if (!session.ready || configMissing) return;

		const path = page.url.pathname;
		const welcome = resolve('/welcome');

		if (session.user && !session.profile && path !== welcome) {
			void goto(welcome);
			return;
		}

		if (session.user && session.profile && path === welcome) {
			void goto(resolve('/'));
		}
	});

	$effect(() => {
		const userId = session.user?.id ?? null;
		if (userId === observedUser) return;
		observedUser = userId;
		void session.refreshUnread();
	});

	async function signOut() {
		await supabase.auth.signOut();
		await goto(resolve('/'));
	}
</script>

<a class="skip" href="#main">К содержимому</a>

<header class="app-header">
	<div class="wrap app-header__inner">
		<a class="app-header__brand" href={resolve('/')}>
			<span class="app-header__mark" style="--mark: url('{asset('mark.png')}')" aria-hidden="true"
			></span>
			ForQ
		</a>

		<nav class="app-header__nav" aria-label="Основная навигация">
			{#if session.user}
				<a
					class="btn btn--quiet app-header__bell"
					href={resolve('/notifications')}
					aria-label={session.unread > 0 ? `Уведомления: ${session.unread} новых` : 'Уведомления'}
				>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
						<path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5 1.5 5h-15S6 13 6 9Z" stroke-linecap="round" stroke-linejoin="round" />
						<path d="M10 18a2 2 0 0 0 4 0" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
					{#if session.unread > 0}
						<span class="app-header__badge">{session.unread > 99 ? '99+' : session.unread}</span>
					{/if}
				</a>

				{#if session.profile}
					<a
						class="btn btn--quiet"
						href={resolve('/u/[username]', { username: session.profile.username })}
					>
						@{session.profile.username}
					</a>
				{/if}
				<a class="btn btn--quiet" href={resolve('/settings')}>Настройки</a>
				<button type="button" class="btn btn--quiet" onclick={signOut}>Выйти</button>
			{:else}
				<a class="btn btn--quiet" href={resolve('/login')}>Вход</a>
				<a class="btn btn--primary" href={resolve('/signup')}>Регистрация</a>
			{/if}
		</nav>
	</div>
</header>

<main class="app-main" id="main">
	<div class="wrap">
		{#if configMissing}
			<section class="panel stack">
				<h1>ForQ пока не настроен</h1>
				<p class="muted">
					Впиши <code>PUBLIC_SUPABASE_URL</code> и <code>PUBLIC_SUPABASE_ANON_KEY</code> в файл
					<code>.env</code> в корне проекта, потом перезапусти сборку.
				</p>
				<p class="muted small">
					Оба значения лежат в дашборде Supabase: Project Settings → API Keys. Сначала примени
					<code>supabase/migrations/0001_init.sql</code> и <code>0002_features.sql</code> в SQL Editor.
				</p>
			</section>
		{:else if session.ready}
			{@render children()}
		{:else}
			<p class="muted">Загрузка…</p>
		{/if}
	</div>
</main>

<style>
	.skip {
		position: absolute;
		inset-inline-start: -100vw;
		z-index: 100;
		padding: 0.75rem 1rem;
		background: var(--fg);
		color: var(--bg);
		border-radius: 0 0 var(--radius) 0;
	}

	.skip:focus-visible {
		inset-inline-start: 0;
	}

	.app-header__mark {
		width: 1.375rem;
		height: 1.375rem;
		flex: none;
		background: currentColor;
		-webkit-mask-image: var(--mark);
		mask-image: var(--mark);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-position: center;
		mask-position: center;
		-webkit-mask-size: contain;
		mask-size: contain;
	}

	.app-header__bell {
		position: relative;
		padding-inline: 0.75rem;
	}

	.app-header__badge {
		min-width: 1.25rem;
		padding-inline: 0.25rem;
		border-radius: 999px;
		background: var(--accent);
		color: var(--bg);
		font-size: 0.6875rem;
		font-weight: 600;
		line-height: 1.25rem;
		text-align: center;
	}
</style>
