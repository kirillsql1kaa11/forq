<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { changePassword, errorMessage } from '#lib/api';
	import { session } from '#lib/session.svelte';
	import { PASSWORD_MIN } from '#lib/types';

	let password = $state('');
	let confirmation = $state('');
	let busy = $state(false);
	let error = $state('');

	const canSubmit = $derived(
		password.length >= PASSWORD_MIN && password === confirmation && !busy
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) return;

		busy = true;
		error = '';

		try {
			await changePassword(password);
			await goto(resolve('/'));
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Новый пароль — ForQ</title>
</svelte:head>

<section class="panel stack">
	<h1>Новый пароль</h1>

	{#if !session.ready}
		<p class="muted">Проверяю ссылку…</p>
	{:else if !session.user}
		<p class="alert alert--error" role="alert">
			Ссылка недействительна или устарела. Запроси новую.
		</p>
		<a class="btn btn--primary" href={resolve('/reset')}>Запросить ссылку</a>
	{:else}
		<form class="stack" onsubmit={submit}>
			<div class="field">
				<label class="field__label" for="new-password">Пароль</label>
				<input
					id="new-password"
					class="field__input"
					type="password"
					bind:value={password}
					autocomplete="new-password"
					minlength={PASSWORD_MIN}
					required
				/>
			</div>

			<div class="field">
				<label class="field__label" for="new-password-again">Ещё раз</label>
				<input
					id="new-password-again"
					class="field__input"
					type="password"
					bind:value={confirmation}
					autocomplete="new-password"
					required
				/>
				{#if confirmation.length > 0 && password !== confirmation}
					<p class="field__error">Пароли не совпадают.</p>
				{/if}
			</div>

			{#if error}
				<p class="field__error" role="alert">{error}</p>
			{/if}

			<button type="submit" class="btn btn--primary" disabled={!canSubmit}>
				{busy ? 'Сохраняю…' : 'Сохранить пароль'}
			</button>
		</form>
	{/if}
</section>
