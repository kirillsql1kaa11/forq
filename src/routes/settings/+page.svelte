<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { changePassword, deleteAccount, errorMessage, signOut, updateProfile, uploadAvatar } from '#lib/api';
	import {
		ACCENTS,
		ACCENT_SWATCH,
		ACCENT_TEXT,
		THEMES,
		THEME_TEXT,
		applyAccent,
		applyTheme,
		readAccent,
		readTheme,
		type Accent,
		type Theme
	} from '#lib/appearance';
	import Avatar from '#lib/components/Avatar.svelte';
	import { prepareAvatar } from '#lib/image';
	import { session } from '#lib/session.svelte';
	import { BIO_MAX, PASSWORD_MIN } from '#lib/types';

	let bio = $state(session.profile?.bio ?? '');
	let busy = $state(false);
	let notice = $state('');
	let error = $state('');

	let password = $state('');
	let confirmation = $state('');
	let passwordBusy = $state(false);
	let passwordNotice = $state('');
	let passwordError = $state('');

	let confirming = $state('');
	let accountBusy = $state(false);
	let accountError = $state('');

	let theme = $state<Theme>(readTheme());
	let accent = $state<Accent>(readAccent());

	const passwordReady = $derived(
		password.length >= PASSWORD_MIN && password === confirmation
	);

	function pickTheme(next: Theme) {
		theme = next;
		applyTheme(next);
	}

	function pickAccent(next: Accent) {
		accent = next;
		applyAccent(next);
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!session.user) return;

		busy = true;
		notice = '';
		error = '';

		try {
			await updateProfile(session.user.id, { bio: bio.trim() || null });
			await session.refreshProfile();
			notice = 'Сохранено.';
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			busy = false;
		}
	}

	async function pickAvatar(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !session.user) return;

		notice = '';
		error = '';

		if (!file.type.startsWith('image/')) {
			error = 'Нужен файл изображения.';
			input.value = '';
			return;
		}

		if (file.size > 10 * 1024 * 1024) {
			error = 'Файл больше 10 МБ.';
			input.value = '';
			return;
		}

		busy = true;

		try {
			const image = await prepareAvatar(file);
			const url = await uploadAvatar(session.user.id, image);
			await updateProfile(session.user.id, { avatar_url: url });
			await session.refreshProfile();
			notice = 'Аватар обновлён.';
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			busy = false;
			input.value = '';
		}
	}

	async function savePassword(event: SubmitEvent) {
		event.preventDefault();
		if (!passwordReady) return;

		passwordBusy = true;
		passwordNotice = '';
		passwordError = '';

		try {
			await changePassword(password);
			password = '';
			confirmation = '';
			passwordNotice = 'Пароль обновлён.';
		} catch (cause) {
			passwordError = errorMessage(cause);
		} finally {
			passwordBusy = false;
		}
	}

	async function removeAccount(event: SubmitEvent) {
		event.preventDefault();
		if (!session.profile || confirming !== session.profile.username) return;

		accountBusy = true;
		accountError = '';

		try {
			await deleteAccount(confirming);
			await signOut();
			await goto(resolve('/'));
		} catch (cause) {
			accountError = errorMessage(cause);
			accountBusy = false;
		}
	}
</script>

<svelte:head>
	<title>Настройки — ForQ</title>
</svelte:head>

<h1>Настройки</h1>

<section class="panel stack">
	<h2>Оформление</h2>

	<fieldset class="appearance">
		<legend class="field__label">Тема</legend>
		<div class="chips">
			{#each THEMES as item (item)}
				<button
					type="button"
					class="chip"
					class:chip--on={theme === item}
					aria-pressed={theme === item}
					onclick={() => pickTheme(item)}
				>
					{THEME_TEXT[item]}
				</button>
			{/each}
		</div>
	</fieldset>

	<fieldset class="appearance">
		<legend class="field__label">Акцент</legend>
		<div class="chips">
			{#each ACCENTS as item (item)}
				<button
					type="button"
					class="chip"
					class:chip--on={accent === item}
					aria-pressed={accent === item}
					onclick={() => pickAccent(item)}
				>
					<span class="chip__swatch" style="--swatch: {ACCENT_SWATCH[item]}" aria-hidden="true"
					></span>
					{ACCENT_TEXT[item]}
				</button>
			{/each}
		</div>
	</fieldset>

	<p class="field__hint">Запоминается в этом браузере и работает без входа.</p>
</section>

{#if session.profile}
	<section class="panel stack">
		<h2>Профиль</h2>
		<p class="small muted">
			Почта: {session.user?.email} · Ник: @{session.profile.username}
		</p>

		<div class="avatar-row">
			<Avatar username={session.profile.username} url={session.profile.avatar_url} size={56} />
			<div class="field">
				<label class="field__label" for="avatar">Аватар</label>
				<input
					id="avatar"
					class="field__input"
					type="file"
					accept="image/png,image/jpeg,image/webp,image/gif"
					onchange={pickAvatar}
					disabled={busy}
				/>
				<p class="field__hint">До 10 МБ. Картинка сжимается до 256 пикселей по длинной стороне.</p>
			</div>
		</div>

		<form class="stack" onsubmit={save}>
			<div class="field">
				<label class="field__label" for="bio">О себе</label>
				<textarea
					id="bio"
					class="field__input"
					bind:value={bio}
					maxlength={BIO_MAX}
					rows="3"
					placeholder="Пара строк о себе"
				></textarea>
				<p class="field__hint">{BIO_MAX - bio.length} символов осталось</p>
			</div>

			{#if error}
				<p class="field__error" role="alert">{error}</p>
			{/if}

			{#if notice}
				<p class="field__hint" role="status">{notice}</p>
			{/if}

			<button type="submit" class="btn btn--primary" disabled={busy}>
				{busy ? 'Сохраняю…' : 'Сохранить'}
			</button>
		</form>
	</section>

	<section class="panel stack">
		<h2>Пароль</h2>

		<form class="stack" onsubmit={savePassword}>
			<div class="field">
				<label class="field__label" for="password">Новый пароль</label>
				<input
					id="password"
					class="field__input"
					type="password"
					bind:value={password}
					autocomplete="new-password"
					minlength={PASSWORD_MIN}
				/>
			</div>

			<div class="field">
				<label class="field__label" for="password-again">Ещё раз</label>
				<input
					id="password-again"
					class="field__input"
					type="password"
					bind:value={confirmation}
					autocomplete="new-password"
				/>
				{#if confirmation.length > 0 && password !== confirmation}
					<p class="field__error">Пароли не совпадают.</p>
				{/if}
			</div>

			{#if passwordError}
				<p class="field__error" role="alert">{passwordError}</p>
			{/if}

			{#if passwordNotice}
				<p class="field__hint" role="status">{passwordNotice}</p>
			{/if}

			<button type="submit" class="btn btn--primary" disabled={!passwordReady || passwordBusy}>
				{passwordBusy ? 'Меняю…' : 'Сменить пароль'}
			</button>
		</form>
	</section>

	<section class="panel stack delete-account">
		<h2>Удаление аккаунта</h2>
		<p class="muted small">
			Профиль, посты, ответы и отметки «нравится» удаляются навсегда. Восстановить их нельзя, ник
			освободится и его сможет занять кто угодно.
		</p>

		<form class="stack" onsubmit={removeAccount}>
			<div class="field">
				<label class="field__label" for="delete-confirm">
					Введи свой ник, чтобы подтвердить
				</label>
				<input
					id="delete-confirm"
					class="field__input"
					bind:value={confirming}
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					placeholder={session.profile.username}
				/>
			</div>

			{#if accountError}
				<p class="field__error" role="alert">{accountError}</p>
			{/if}

			<button
				type="submit"
				class="btn delete-account__submit"
				disabled={confirming !== session.profile.username || accountBusy}
			>
				{accountBusy ? 'Удаляю…' : 'Удалить аккаунт'}
			</button>
		</form>
	</section>
{:else}
	<section class="panel stack">
		<p class="muted">Остальные настройки появятся после входа в аккаунт.</p>
		<a class="btn btn--primary settings__login" href={resolve('/login')}>Войти</a>
	</section>
{/if}

<style>
	.avatar-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 1rem;
		align-items: start;
	}

	h2 {
		font-size: 1rem;
	}

	.settings__login {
		justify-self: start;
	}

	.appearance {
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.appearance legend {
		padding: 0;
		margin-block-end: 0.5rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 2.25rem;
		padding-inline: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--bg);
		font-size: 0.875rem;
	}

	.chip:hover {
		background: var(--surface);
	}

	.chip--on {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 8%, transparent);
		color: var(--accent);
	}

	.chip__swatch {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 999px;
		background: var(--swatch);
	}

	.delete-account {
		border-color: color-mix(in srgb, var(--danger) 40%, var(--border));
	}

	.delete-account__submit {
		justify-self: start;
		border-color: var(--danger);
		color: var(--danger);
	}
</style>
