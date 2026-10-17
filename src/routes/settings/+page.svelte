<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Avatar from '#lib/components/Avatar.svelte';
	import { errorMessage, updateProfile, uploadAvatar } from '#lib/api';
	import { session } from '#lib/session.svelte';
	import { BIO_MAX } from '#lib/types';

	let bio = $state(session.profile?.bio ?? '');
	let busy = $state(false);
	let notice = $state('');
	let error = $state('');

	$effect(() => {
		if (session.ready && !session.user) void goto(resolve('/login'));
	});

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

		if (file.size > 2 * 1024 * 1024) {
			error = 'Файл больше 2 МБ.';
			input.value = '';
			return;
		}

		busy = true;

		try {
			const url = await uploadAvatar(session.user.id, file);
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
</script>

<svelte:head>
	<title>Настройки — ForQ</title>
</svelte:head>

{#if session.profile}
	<section class="panel stack">
		<h1>Настройки</h1>
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
				<p class="field__hint">PNG, JPEG, WebP или GIF, до 2 МБ.</p>
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
{/if}

<style>
	.avatar-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 1rem;
		align-items: start;
	}
</style>
