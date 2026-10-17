<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { supabase } from '#lib/supabase';

	let email = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = '';

		const { error: authError } = await supabase.auth.signInWithPassword({
			email: email.trim(),
			password
		});

		busy = false;

		if (authError) {
			error =
				authError.message === 'Invalid login credentials'
					? 'Неверная почта или пароль.'
					: authError.message;
			return;
		}

		await goto(resolve('/'));
	}
</script>

<svelte:head>
	<title>Вход — ForQ</title>
</svelte:head>

<section class="panel stack">
	<h1>Вход</h1>

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
			<label class="field__label" for="password">Пароль</label>
			<input
				id="password"
				class="field__input"
				type="password"
				bind:value={password}
				autocomplete="current-password"
				required
			/>
		</div>

		{#if error}
			<p class="field__error" role="alert">{error}</p>
		{/if}

		<button type="submit" class="btn btn--primary" disabled={busy}>
			{busy ? 'Вхожу…' : 'Войти'}
		</button>
	</form>

	<p class="small muted">
		Нет аккаунта? <a href={resolve('/signup')}>Зарегистрироваться</a>
	</p>
</section>
