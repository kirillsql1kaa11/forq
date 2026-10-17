<script lang="ts">
	import { goto } from '$app/navigation';
	import { supabase } from '#lib/supabase';
	import { USERNAME_PATTERN } from '#lib/types';

	let email = $state('');
	let username = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state('');
	let sent = $state(false);

	const usernameBad = $derived(username.length > 0 && !USERNAME_PATTERN.test(username));
	const canSubmit = $derived(
		email.trim().length > 0 && USERNAME_PATTERN.test(username) && password.length >= 6 && !busy
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) return;

		busy = true;
		error = '';

		const { data, error: authError } = await supabase.auth.signUp({
			email: email.trim(),
			password,
			options: { data: { username: username.toLowerCase() } }
		});

		busy = false;

		if (authError) {
			error = authError.message;
			return;
		}

		if (data.session) {
			await goto('/');
			return;
		}

		sent = true;
	}
</script>

<svelte:head>
	<title>Регистрация — ForQ</title>
</svelte:head>

<section class="panel stack">
	<h1>Регистрация</h1>

	{#if sent}
		<p class="alert">
			Письмо со ссылкой отправлено на <strong>{email}</strong>. Перейди по ней, чтобы подтвердить
			аккаунт.
		</p>
	{:else}
		<form class="stack" onsubmit={submit}>
			<div class="field">
				<label class="field__label" for="email">Почта</label>
				<input
					id="email"
					class="field__input"
					type="email"
					bind:value={email}
					autocomplete="email"
					required
				/>
			</div>

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
				{:else}
					<p class="field__hint">Латиница в нижнем регистре, 3–24 символа. Потом @{username || 'ник'} видно всем.</p>
				{/if}
			</div>

			<div class="field">
				<label class="field__label" for="password">Пароль</label>
				<input
					id="password"
					class="field__input"
					type="password"
					bind:value={password}
					autocomplete="new-password"
					minlength="6"
					required
				/>
				<p class="field__hint">Минимум 6 символов.</p>
			</div>

			{#if error}
				<p class="field__error" role="alert">{error}</p>
			{/if}

			<button type="submit" class="btn btn--primary" disabled={!canSubmit}>
				{busy ? 'Создаю…' : 'Создать аккаунт'}
			</button>
		</form>

		<p class="small muted">
			Уже есть аккаунт? <a href="/login">Войти</a>
		</p>
	{/if}
</section>
