# AGENTS.md

## Стек

SvelteKit 3 + Svelte 5 (руны), TypeScript, Vite 8. SPA через `@sveltejs/adapter-static`. Supabase как бэкенд целиком (Auth, Postgres + RLS, PostgREST, Storage). Серверного кода нет.

## Команды

- `npm run dev` — дев-сервер
- `npm run build` — сборка в `build/`
- `npm run check` — `svelte-kit sync` + `svelte-check`; запускать перед сдачей
- `npm run preview` — предпросмотр сборки

## Что важно знать про SvelteKit 3

Эти вещи отличаются от SvelteKit 2 и легко ломают сборку:

- Конфиг только в `vite.config.ts` внутри `sveltekit({...})`. `svelte.config.js` больше не поддерживается и вызывает ошибку `config_file_unsupported`.
- `$lib` удалён. Импорты только `#lib/*`, маппинг в `package.json` → `imports`.
- `$app/stores` удалён. Состояние страницы — `import { page } from '$app/state'`, без `$page`.
- Env: объявление в `src/env.ts` через `defineEnvVars`, чтение из `$app/env/public`. Старые `$env/static/public` и `$env/dynamic/public` не существуют.
- tsconfig наследует `$app/tsconfig` (файл генерируется в `node_modules/$app/tsconfig.json`). Пути для `#lib/*` прописаны вручную в `tsconfig.json`, потому что генератор их не создаёт.
- Типы маршрутов лежат в `.svelte-kit/types`, параметры вида `page.params.username` имеют тип `string | undefined` — нужно приводить.

## Структура

- `src/lib/api.ts` — единственное место с запросами к Supabase. Ошибки БД переводятся в русские сообщения через `describe()` по коду SQLSTATE.
- `src/lib/posts.svelte.ts` — `PostList` управляет списком постов: курсорная пагинация по `id`, оптимистичные правки с откатом. Компоненты `PostCard` управляемые: локальных копий состояния поста нет, иначе после перезагрузки списка данные устаревают.
- `src/lib/session.svelte.ts` — пользователь и профиль. Внутри `onAuthStateChange` нельзя сразу звать Supabase (дедлок), поэтому загрузка профиля отложена через `setTimeout`.
- `src/routes/+layout.svelte` — гейт по сессии и редиректы: без профиля → `/welcome`, с профилем на `/welcome` → `/`.

## База

Схема целиком в `supabase/migrations/0001_init.sql`, скрипт идемпотентен.

Правила, которые нельзя нарушать:

- Права выдаются точечно: `revoke all`, затем `grant` на конкретные колонки. Добавляя колонку с правом на запись, не забыть `grant update (колонка)`.
- Таблицы `likes` и `comments` не имеют политики `DELETE` там, где нужно мягкое удаление. У `posts` политики `DELETE` нет вовсе.
- Представления обязаны иметь `security_invoker = true`, иначе обходят RLS.
- Счётчики в `feed` считаются подзапросами. При росте данных до десятков тысяч постов понадобится денормализованное поле со счётчиком.

## Стиль кода

Без комментариев, включая SQL и docstring. Пояснения — в ответе, не в коде.
