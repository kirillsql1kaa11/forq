<script lang="ts">
	import { onDestroy } from 'svelte';
	import { asset, resolve } from '$app/paths';
	import { copyText } from '#lib/clipboard';

	let copied = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;

	onDestroy(() => clearTimeout(timer));

	function site(): string {
		return typeof location === 'undefined' ? '' : new URL(resolve('/'), location.origin).toString();
	}

	function shortText(): string {
		return `ForQ — текстовая соцсеть без алгоритмов. Одна лента, посты до 500 символов, только текст. ${site()}`;
	}

	function postText(): string {
		return `ForQ — короткие текстовые посты. Одна лента, новые сверху, без алгоритмов и бесконечной прокрутки. 500 символов, которых хватает.\n\n${site()}`;
	}

	async function copy(kind: 'short' | 'post') {
		const ok = await copyText(kind === 'short' ? shortText() : postText());
		if (!ok) return;

		copied = kind;
		clearTimeout(timer);
		timer = setTimeout(() => (copied = ''), 2000);
	}
</script>

<svelte:head>
	<title>О проекте — ForQ</title>
</svelte:head>

<article class="about">
	<header class="about__head">
		<p class="about__kicker">ForQ</p>
		<h1>Текстовая соцсеть без лишнего</h1>
		<p class="about__lead">
			Одна лента, новые сверху. Посты до 500 символов. Никаких алгоритмов, картинок и
			бесконечной прокрутки.
		</p>
	</header>

	<section class="about__section stack">
		<h2>Зачем это</h2>
		<p>
			ForQ — место, где можно сказать главное и не тратить на это вечер. Здесь нечего листать
			часами: текст, люди и одна лента. Картинки, видео и автоплей остались за бортом — не
			потому что их сложно сделать, а чтобы не отвлекали.
		</p>
		<p>
			Нет рекомендаций и подогрева: в ленте только то, что написали ты и те, на кого ты
			подписан. Хочешь больше — подпишись на кого-то ещё. Хочешь меньше — отпишись.
		</p>
	</section>

	<section class="about__section stack">
		<h2>Что умеет</h2>
		<ul class="about__list">
			<li>
				<strong>Посты до 500 символов.</strong> Достаточно для мысли, недостаточно для
				многостраничного эссе.
			</li>
			<li>
				<strong>Ответы и упоминания.</strong> Можно ответить на пост или на комментарий и
				позвать человека через <code>@ник</code>.
			</li>
			<li>
				<strong>Хештеги и поиск.</strong> Теги собирают посты в отдельные страницы, поиск
				ищет по тексту и людям.
			</li>
			<li>
				<strong>Подписки без шума.</strong> Лента подписок — это только те, кого ты выбрал
				сам.
			</li>
			<li>
				<strong>Светлая и тёмная тема.</strong> Оформление выбирается в настройках и
				запоминается в браузере.
			</li>
		</ul>
	</section>

	<section class="about__section stack">
		<h2>Для каналов</h2>
		<p class="muted">
			Готовое описание и картинки. Можно брать целиком и ставить ссылку на ForQ.
		</p>

		<div class="press">
			<h3>Коротко</h3>
			<p class="press__text">
				ForQ — текстовая соцсеть без алгоритмов. Одна лента, посты до 500 символов, только
				текст.
			</p>
			<button type="button" class="btn press__copy" onclick={() => copy('short')}>
				{copied === 'short' ? 'Скопировано' : 'Скопировать'}
			</button>
		</div>

		<div class="press">
			<h3>Для поста</h3>
			<p class="press__text">
				ForQ — короткие текстовые посты. Одна лента, новые сверху, без алгоритмов и
				бесконечной прокрутки. 500 символов, которых хватает.
			</p>
			<button type="button" class="btn press__copy" onclick={() => copy('post')}>
				{copied === 'post' ? 'Скопировано' : 'Скопировать'}
			</button>
		</div>

		<div class="about__assets">
			<a class="btn" href={asset('og.png')} download="forq-og.png">Картинка 1200×630</a>
			<a class="btn" href={asset('icon-512.png')} download="forq.png">Логотип 512×512</a>
		</div>

		<p class="small muted" role="status">{copied ? 'Текст скопирован.' : ''}</p>
	</section>

	<section class="about__section stack">
		<h2>Скриншоты</h2>
		<div class="shots">
			<figure class="shot">
				<img
					src={asset('press/feed-light.png')}
					alt="Главная страница ForQ в светлой теме"
					width="800"
					height="1000"
					loading="lazy"
				/>
				<figcaption>Главная, светлая тема</figcaption>
			</figure>

			<figure class="shot">
				<img
					src={asset('press/profile-dark.png')}
					alt="Профиль ForQ в тёмной теме"
					width="800"
					height="1000"
					loading="lazy"
				/>
				<figcaption>Профиль, тёмная тема</figcaption>
			</figure>
		</div>
		<p class="small muted">Скриншоты можно заменить своими — главное, чтобы была видна лента.</p>
	</section>

	<p class="about__back"><a href={resolve('/')}>← В ленту</a></p>
</article>

<style>
	.about {
		display: grid;
		gap: 1.75rem;
	}

	.about__head {
		display: grid;
		gap: 0.5rem;
		padding-block-end: 0.25rem;
	}

	.about__head h1 {
		font-size: clamp(1.5rem, 4vw, 2rem);
		letter-spacing: -0.02em;
	}

	.about__kicker {
		color: var(--accent);
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.about__lead {
		max-width: 34rem;
		font-size: 1.0625rem;
	}

	.about__section {
		padding-block-start: 1.25rem;
		border-top: 1px solid var(--border);
	}

	.about__section h2 {
		font-size: 1rem;
	}

	.about__section h3 {
		font-size: 0.9375rem;
	}

	.about__list {
		display: grid;
		gap: 0.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.about__list li {
		padding-inline-start: 0.875rem;
		border-inline-start: 2px solid var(--border);
	}

	.press {
		display: grid;
		gap: 0.5rem;
		padding-block: 0.75rem;
		border-top: 1px solid var(--border);
	}

	.press__text {
		font-size: 0.9375rem;
	}

	.press__copy {
		justify-self: start;
		min-height: 2.25rem;
		font-size: 0.8125rem;
	}

	.about__assets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.shots {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
	}

	.shot {
		margin: 0;
	}

	.shot img {
		display: block;
		width: 100%;
		height: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}

	.shot figcaption {
		margin-block-start: 0.375rem;
		color: var(--muted);
		font-size: 0.8125rem;
	}

	.about__back {
		margin-block-start: 0.5rem;
	}
</style>
