<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { claimUsername, errorMessage } from '#lib/api';
	import { session } from '#lib/session.svelte';
	import { USERNAME_PATTERN } from '#lib/types';

	const meta = session.user?.user_metadata as { username?: string } | undefined;

	let username = $state(meta?.username ?? '');
	let busy = $state(false);
	let error = $state('');

	const usernameBad = $derived(username.length > 0 && !USERNAME_PATTERN.test(username));
	const canSubmit = $derived(USERNAME_PATTERN.test(username) && !busy);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) return;

		busy = true;
		error = '';

		try {
			await claimUsername(username);
			await session.refreshProfile();
			await goto(resolve('/'));
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Выбери ник — ForQ</title>
</svelte:head>

<section class="panel stack">
	<h1>Выбери ник</h1>
	<p class="muted">Он будет виден рядом с каждым постом. Изменить потом нельзя.</p>

	<form class="stack" onsubmit={submit}>
		<div class="field">
			<label class="field__label" for="username">Ник</label>
			<input
				id="username"
				class="field__input"
				type="text"
				bind:value={username}
				autocomplete="username"
				autocapitalize="none"
				spellcheck="false"
				required
			/>
			{#if usernameBad}
				<p class="field__error" role="alert">
					3–24 символа: латиница в нижнем регистре, цифры и подчёркивание.
				</p>
			{/if}
		</div>

		{#if error}
			<p class="field__error" role="alert">{error}</p>
		{/if}

		<button type="submit" class="btn btn--primary" disabled={!canSubmit}>
			{busy ? 'Сохраняю…' : 'Готово'}
		</button>
	</form>
</section>
