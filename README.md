# ForQ

Минималистичная текстовая соцсеть. Регистрация по почте, посты до 500 символов, лента отсортирована по новизне. Никаких алгоритмов и реалтайма.

## Стек

| Слой | Что используется |
| --- | --- |
| Фронт | SvelteKit 3 (SPA, `adapter-static`), Svelte 5 с рунами |
| Стили | чистый CSS, токены в `src/app.css`, тёмная тема через `prefers-color-scheme` |
| Данные | Supabase напрямую из браузера: Auth, Postgres + RLS, PostgREST, Storage |
| Хостинг | GitHub Pages или Netlify (статика из `build/`) |

Серверного кода нет: весь доступ к данным идёт через PostgREST с anon-ключом, а разграничение прав делает RLS в Postgres.

## Запуск

```bash
npm install
cp .env.example .env
npm run dev
```

В `.env` нужны два значения из дашборда Supabase (Project Settings → API Keys):

```
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

Годится и новый ключ `sb_publishable_...`, и старый anon-JWT — оба публичные по задумке и оба попадают в бандл браузера. Ключ `service_role` / `sb_secret_...` сюда класть нельзя ни в каком виде.

Пока значения пустые, приложение показывает экран «ForQ пока не настроен».

## Настройка Supabase

1. SQL Editor → New query → вставить `supabase/migrations/0001_init.sql` → Run.
2. Authentication → Sign In / Providers → Email: включить провайдер и оставить `Confirm email` включённым.
3. Authentication → URL Configuration:
   - Site URL — адрес, куда возвращать после подтверждения письма.
   - Redirect URLs — список разрешённых адресов. Для разработки `http://localhost:5173/**`, для продакшена адрес страницы на Pages или Netlify, например `https://имя.github.io/**`.

Приложение передаёт `emailRedirectTo` с текущим origin, но Supabase проигнорирует адрес, которого нет в списке Redirect URLs.

## База

Единственная миграция: `supabase/migrations/0001_init.sql`. Применяется целиком в Supabase → SQL Editor → New query → Run. Скрипт идемпотентен, повторный запуск не ломает схему.

Что создаётся:

- `profiles` — ник, био, аватар. Строка появляется через RPC `claim_username`, а не триггером на `auth.users`.
- `posts` — текст поста, `edited_at`, `deleted_at`. Удаление только мягкое: политики `DELETE` нет вообще.
- `likes`, `comments` — составные ключи и мягкое удаление комментариев.
- `feed` — представление с `security_invoker = true`: отдаёт пост вместе с ником, аватаром, счётчиками и флагом `liked_by_me`.

Права выдаются точечно: `revoke all` для `anon` и `authenticated`, затем `grant` на конкретные колонки (`update (body, deleted_at)`). Поэтому нельзя переписать `created_at` и поднять свой пост в ленте, а `username` изменить через API невозможно вообще.

Отдельно стоит `enforce_post_rate`: триггер `before insert` не даёт публиковать больше 5 постов в минуту. Ошибки приходят клиенту кодами (`54000` — лимит, `23505` — ник занят, `23514` — текст не проходит проверку), клиент переводит их в человеческие сообщения в `src/lib/api.ts`.

## Пагинация

Курсором по `id`, а не по времени и не через `OFFSET`:

```
GET feed?order=id.desc&limit=20
GET feed?order=id.desc&limit=20&id=lt.<последний_увиденный_id>
```

`id` — монотонный `identity`, поэтому порядок по нему совпадает с порядком по времени, но фильтр остаётся одним условием. Индексы `posts_feed_idx` и `posts_author_idx` частичные (`where deleted_at is null`).

## Структура

```
src/
  env.ts                     объявление публичных env-переменных
  app.css                    токены, кнопки, поля, каркас
  lib/
    supabase.ts              клиент и флаг configMissing
    session.svelte.ts        пользователь + профиль, подписка на auth
    api.ts                   все запросы и перевод ошибок БД
    posts.svelte.ts          PostList: загрузка, курсор, оптимистичные правки
    format.ts                timeAgo, fullDate, monthYear
    components/              Avatar, PostCard, Composer
  routes/
    +layout.svelte           шапка, гейт по сессии, редиректы
    +page.svelte             лента
    login/ signup/ welcome/  вход, регистрация, выбор ника
    u/[username]/            профиль
    p/[id]/                  пост и комментарии
    settings/                аватар и био
supabase/migrations/0001_init.sql
netlify.toml                   сборка, переменные окружения и SPA-роутинг для Netlify
```

## Особенности SvelteKit 3

Проект собран на SvelteKit 3, где поменялся ряд вещей относительно второй версии:

- `svelte.config.js` не используется — конфиг целиком в `sveltekit()` внутри `vite.config.ts`.
- `$lib` удалён, вместо него сабпат-импорты `#lib/*` из `package.json` → `imports`.
- `$app/stores` заменён на `$app/state`, `page` теперь обычный объект.
- Env-переменные объявляются явно в `src/env.ts` и читаются из `$app/env/public`, а не из `$env/static/public`.
- tsconfig наследуется от `$app/tsconfig` (генерируется в `node_modules/$app/tsconfig.json`).

`tsconfig.json` дополнительно прописывает `paths` для `#lib/*`, иначе TypeScript не находит эти импорты.

## Хостинг

Сайт живёт на Netlify, публикуется статика из `build/`. Всё нужное лежит в `netlify.toml` — он читается автоматически при импорте репозитория, руками в панели ничего настраивать не нужно:

| Что | Значение |
| --- | --- |
| Команда сборки | `npm run build` |
| Публикуемая папка | `build` |
| Версия Node | `22` (SvelteKit 3 требует не ниже 22.17) |
| Переменные Supabase | `[build.environment]` |
| SPA-роутинг | `[[redirects]]` и `static/_redirects` |

Правило `/* /index.html 200` отдаёт приложение на любой путь: серверного роутера у статики нет, поэтому `/u/имя` и `/p/12` должны открывать `index.html`, а маршрут дальше разбирает клиент. Файлы в `_app/immutable/` кешируются на год — имена у них хешированные, так что это безопасно.

Ключи Supabase продублированы в `netlify.toml` без ссылки на переменные окружения Netlify. Это те же публичные значения, которые всё равно уезжают в бандл браузера, поэтому секретом они не являются, зато сборка работает сразу после импорта. Если ключи поменяются, править нужно и `.env`, и `netlify.toml`.

### Почему не Cloudflare

Замеры задержки с машины в Екатеринбурге (октябрь 2026):

| Площадка | Результат |
| --- | --- |
| `*.supabase.co` | открывается, 0,09 с на соединение |
| `*.netlify.app` | открывается, 0,14 с |
| `*.github.io` | открывается, 0,18 с |
| `*.vercel.app` | таймаут |
| `*.pages.dev` | таймаут |

Cloudflare Pages и Vercel из России не открываются. При этом Supabase сам отдаётся через Cloudflare и работает — то есть режут не весь Cloudflare, а конкретные площадки. GitHub Pages тоже рабочий вариант, но там пришлось бы возиться с подпутём и отдавать `404` на прямые ссылки.

### Про подпуть

`vite.config.ts` читает переменную окружения `BASE_PATH`:

```bash
BASE_PATH=/forq npm run build
```

Все ссылки в проекте обёрнуты в `resolve()` из `$app/paths`, поэтому сборка одинаково работает и в корне домена, и в подпапке. Для Netlify переменную задавать не нужно — сайт лежит в корне.

## Команды

```bash
npm run dev      # дев-сервер
npm run build    # сборка в build/
npm run preview  # предпросмотр сборки
npm run check    # svelte-kit sync + svelte-check
```

## Что не сделано

- Капча на регистрации. При открытой регистрации включается за пару шагов: Cloudflare Turnstile в Supabase Auth → Settings → Bot and Abuse Protection, затем токен виджета передавать в `options.captchaToken` при `signUp`.
- Своя отправка писем. Встроенный SMTP Supabase не годится для реальных получателей — нужен Resend или аналог в Auth → Settings → SMTP.
- Жалобы на посты и модерация.
- Абсолютные даты в постах не в локали пользователя, а в русской.
- Нет e2e-тестов.
