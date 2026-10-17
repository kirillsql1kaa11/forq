<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { session } from '#lib/session.svelte';
	import { configMissing, supabase } from '#lib/supabase';
	import '../app.css';

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		if (!configMissing) void session.start();
	});

	$effect(() => {
		if (!session.ready) return;

		const path = page.url.pathname;

		if (session.user && !session.profile && path !== '/welcome') {
			void goto('/welcome');
			return;
		}

		if (session.user && session.profile && path === '/welcome') {
			void goto('/');
		}
	});

	async function signOut() {
		await supabase.auth.signOut();
		await goto('/');
	}
</script>

<a class="skip" href="#main">К содержимому</a>

<header class="app-header">
	<div class="wrap app-header__inner">
		<a class="app-header__brand" href="/">ForQ</a>

		<nav class="app-header__nav" aria-label="Основная навигация">
			{#if session.user}
				{#if session.profile}
					<a class="btn btn--quiet" href="/u/{session.profile.username}">@{session.profile.username}</a>
				{/if}
				<a class="btn btn--quiet" href="/settings">Настройки</a>
				<button type="button" class="btn btn--quiet" onclick={signOut}>Выйти</button>
			{:else}
				<a class="btn btn--quiet" href="/login">Вход</a>
				<a class="btn btn--primary" href="/signup">Регистрация</a>
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
					Оба значения лежат в дашборде Supabase: Project Settings → API. Сначала примени
					<code>supabase/migrations/0001_init.sql</code> в SQL Editor.
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
</style>
