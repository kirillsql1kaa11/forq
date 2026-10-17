<script lang="ts">
	import { resolve } from '$app/paths';
	import { errorMessage, sendPasswordReset } from '#lib/api';

	let email = $state('');
	let busy = $state(false);
	let sent = $state(false);
	let error = $state('');

	const canSubmit = $derived(email.trim().length > 0 && !busy);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) return;

		busy = true;
		error = '';

		try {
			await sendPasswordReset(email.trim(), window.location.origin + resolve('/reset/confirm'));
			sent = true;
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Восстановление пароля — ForQ</title>
</svelte:head>

<section class="panel stack">
	<h1>Восстановление пароля</h1>

	{#if sent}
		<p class="alert">
			Если <strong>{email}</strong> зарегистрирован, туда ушло письмо со ссылкой для смены пароля.
		</p>
	{:else}
		<form class="stack" onsubmit={submit}>
			<div class="field">
				<label class="field__label" for="reset-email">Почта</label>
				<input
					id="reset-email"
					class="field__input"
					type="email"
					bind:value={email}
					autocomplete="email"
					required
				/>
			</div>

			{#if error}
				<p class="field__error" role="alert">{error}</p>
			{/if}

			<button type="submit" class="btn btn--primary" disabled={!canSubmit}>
				{busy ? 'Отправляю…' : 'Отправить ссылку'}
			</button>
		</form>
	{/if}

	<p class="small muted">
		<a href={resolve('/login')}>Вернуться ко входу</a>
	</p>
</section>
