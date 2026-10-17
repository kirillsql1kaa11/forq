# AGENTS.md

## Стек

SvelteKit 3 + Svelte 5 (руны), TypeScript, Vite 8. SPA через `@sveltejs/adapter-static`. Supabase как бэкенд целиком (Auth, Postgres + RLS, PostgREST, Storage). Серверного кода нет.

## Команды

- `npm run dev` — дев-сервер
- `npm run build` — сборка в `build/`
- `npm run check` — `svelte-kit sync` + `svelte-check`; запускать перед сдачей
- `npm run preview` — предпросмотр сборки
- `npm run icons` — перегенерировать PNG-иконки PWA из `scripts/icons.mjs` (нужен dev-зависимость `sharp`)

## Что важно знать про SvelteKit 3

Эти вещи отличаются от SvelteKit 2 и легко ломают сборку:

- Конфиг только в `vite.config.ts` внутри `sveltekit({...})`. `svelte.config.js` больше не поддерживается и вызывает ошибку `config_file_unsupported`.
- `$lib` удалён. Импорты только `#lib/*`, маппинг в `package.json` → `imports`.
- `$app/stores` удалён. Состояние страницы — `import { page } from '$app/state'`, без `$page`.
- Env: объявление в `src/env.ts` через `defineEnvVars`, чтение из `$app/env/public`. Старые `$env/static/public` и `$env/dynamic/public` не существуют.
- tsconfig наследует `$app/tsconfig` (файл генерируется в `node_modules/$app/tsconfig.json`). Пути для `#lib/*` прописаны вручную в `tsconfig.json`, потому что генератор их не создаёт.
- Типы маршрутов лежат в `.svelte-kit/types`, параметры вида `page.params.username` имеют тип `string | undefined` — нужно приводить.
- `$app/paths` экспортирует `resolve`, но не `base`. Ссылки внутри приложения нельзя писать строкой: `resolve('/settings')`, `resolve('/u/[username]', { username })`. Так базовый путь из `paths.base` подставляется сам, и сборка работает и в корне домена, и в подпапке. Базовый путь задаётся переменной окружения `BASE_PATH` при сборке.

## Структура

- `src/lib/api.ts` — единственное место с запросами к Supabase. Ошибки БД переводятся в русские сообщения через `describe()` по коду SQLSTATE, ошибки Auth — через `authMessage()` по тексту ответа.
- `src/lib/posts.svelte.ts` — `PostList` управляет списком постов: курсорная пагинация по `id`, оптимистичные правки с откатом, временные записи для оптимистичной публикации (`placeholder` → `settle`/`drop`, временный id отрицательный, флаг `pending`). Компоненты `PostCard` управляемые: локальных копий состояния поста нет, иначе после перезагрузки списка данные устаревают.
- `src/lib/session.svelte.ts` — пользователь, профиль и счётчик непрочитанных. Внутри `onAuthStateChange` нельзя сразу звать Supabase (дедлок), поэтому загрузка профиля отложена через `setTimeout`.
- `src/lib/format.ts` — время, а также `tokenize()` (разбор `@упоминаний` и `#хештегов`) и `mentionQuery()` (поиск незакрытого упоминания под курсором).
- `src/lib/components/RichText.svelte` — рендер текста с ссылками. Без `{@html}`, текст остаётся экранированным.
- `src/lib/components/PostFeed.svelte` — список постов, действия, необязательный композер. Используется лентой и страницей тега.
- `src/routes/+layout.svelte` — гейт по сессии, редиректы, регистрация service worker только в проде.
- `static/sw.js` — service worker: сеть вперёд, кеш как запас, лимит 150 записей. Хеши сборки не знает намеренно, поэтому лежит в `static/`, а не в `src/service-worker`.

## База

Схема в `supabase/migrations/0001_init.sql` и `0002_features.sql`, оба скрипта идемпотентны. Новая порция изменений — отдельный файл `000N_*.sql`, а не правка существующих.

Правила, которые нельзя нарушать:

- Права выдаются точечно: `revoke all`, затем `grant` на конкретные колонки. Добавляя колонку с правом на запись, не забыть `grant update (колонка)`, иначе PostgREST вернёт `42501`.
- Таблицы `likes` и `comments` не имеют политики `DELETE` там, где нужно мягкое удаление. У `posts` политики `DELETE` нет вовсе.
- Представления обязаны иметь `security_invoker = true`, иначе обходят RLS.
- Триггеры, которым нужен доступ за пределами прав вызывающего (`notifications`, `post_tags`, чтение чужих профилей), объявляются `security definer` и `set search_path = public, pg_temp`.
- `notifications` не имеет права `insert` ни у одной роли: строки создают только триггеры. `authenticated` может лишь читать свои строки и менять `read_at`.
- Лимиты частоты считают строки под `pg_advisory_xact_lock`. Без блокировки параллельные вставки проскакивают мимо проверки.
- Глубина ответов — инвариант базы (`enforce_comment_depth`), а не интерфейса. Не переносить эту логику на клиент.
- Счётчики в `feed` считаются подзапросами. При росте данных до десятков тысяч постов понадобится денормализованное поле со счётчиком.

## Стиль кода

Без комментариев, включая SQL и docstring. Пояснения — в ответе, не в коде.

## Хостинг

Netlify, статика из `build/`. Конфиг в `netlify.toml`: команда сборки, версия Node, переменные Supabase и SPA-роутинг. Публичные ключи Supabase продублированы прямо там — при их ротации править и `.env`, и `netlify.toml`. Ветка деплоя `main`.

Проверено, что `*.pages.dev` и `*.vercel.app` из России недоступны, а `*.netlify.app` и `*.github.io` работают. Менять площадку без повторного замера не стоит.
