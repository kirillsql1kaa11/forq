create table if not exists public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
	bio text check (char_length(bio) <= 200),
	avatar_url text,
	created_at timestamptz not null default now()
);

create table if not exists public.posts (
	id bigint generated always as identity primary key,
	author_id uuid not null references public.profiles (id) on delete cascade,
	body text not null check (char_length(body) between 1 and 500),
	edited_at timestamptz,
	deleted_at timestamptz,
	created_at timestamptz not null default now()
);

create index if not exists posts_feed_idx on public.posts (id desc) where deleted_at is null;
create index if not exists posts_author_idx on public.posts (author_id, id desc) where deleted_at is null;

create table if not exists public.likes (
	post_id bigint not null references public.posts (id) on delete cascade,
	user_id uuid not null references public.profiles (id) on delete cascade,
	created_at timestamptz not null default now(),
	primary key (post_id, user_id)
);

create index if not exists likes_user_idx on public.likes (user_id);

create table if not exists public.comments (
	id bigint generated always as identity primary key,
	post_id bigint not null references public.posts (id) on delete cascade,
	author_id uuid not null references public.profiles (id) on delete cascade,
	body text not null check (char_length(body) between 1 and 500),
	edited_at timestamptz,
	deleted_at timestamptz,
	created_at timestamptz not null default now()
);

create index if not exists comments_post_idx on public.comments (post_id, id) where deleted_at is null;

create or replace view public.feed with (security_invoker = true) as
select
	p.id,
	p.author_id,
	p.body,
	p.edited_at,
	p.created_at,
	pr.username,
	pr.avatar_url,
	(select count(*) from public.likes l where l.post_id = p.id)::int as like_count,
	(
		select count(*) from public.comments c
		where c.post_id = p.id and c.deleted_at is null
	)::int as comment_count,
	exists (
		select 1 from public.likes l
		where l.post_id = p.id and l.user_id = auth.uid()
	) as liked_by_me
from public.posts p
join public.profiles pr on pr.id = p.author_id
where p.deleted_at is null;

create or replace function public.claim_username(p_username text)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
	v_uid uuid := auth.uid();
	v_name text := lower(trim(p_username));
	v_profile public.profiles;
begin
	if v_uid is null then
		raise exception 'not authenticated' using errcode = '42501';
	end if;

	insert into public.profiles (id, username)
	values (v_uid, v_name)
	on conflict (id) do update set username = excluded.username
	returning * into v_profile;

	return v_profile;
end;
$$;

create or replace function public.touch_post_edit()
returns trigger
language plpgsql
as $$
begin
	if new.body is distinct from old.body then
		new.edited_at := now();
	end if;

	return new;
end;
$$;

create or replace function public.enforce_post_rate()
returns trigger
language plpgsql
as $$
declare
	v_recent int;
begin
	select count(*) into v_recent
	from public.posts
	where author_id = new.author_id
		and created_at > now() - interval '1 minute';

	if v_recent >= 5 then
		raise exception 'rate limit exceeded' using errcode = '54000';
	end if;

	return new;
end;
$$;

drop trigger if exists posts_touch_edit on public.posts;
create trigger posts_touch_edit
	before update on public.posts
	for each row
	execute function public.touch_post_edit();

drop trigger if exists posts_rate_limit on public.posts;
create trigger posts_rate_limit
	before insert on public.posts
	for each row
	execute function public.enforce_post_rate();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;

revoke all on public.profiles, public.posts, public.likes, public.comments, public.feed
	from anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant update (bio, avatar_url) on public.profiles to authenticated;

grant select on public.posts to anon, authenticated;
grant insert on public.posts to authenticated;
grant update (body, deleted_at) on public.posts to authenticated;

grant select on public.likes to anon, authenticated;
grant insert, delete on public.likes to authenticated;

grant select on public.comments to anon, authenticated;
grant insert on public.comments to authenticated;
grant update (body, deleted_at) on public.comments to authenticated;

grant select on public.feed to anon, authenticated;

revoke all on function public.claim_username(text) from public, anon;
grant execute on function public.claim_username(text) to authenticated;

revoke all on function public.touch_post_edit() from public, anon;
revoke all on function public.enforce_post_rate() from public, anon;
grant execute on function public.touch_post_edit() to authenticated;
grant execute on function public.enforce_post_rate() to authenticated;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
	for select
	using (true);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
	for update
	using (id = auth.uid())
	with check (id = auth.uid());

drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
	for select
	using (deleted_at is null or author_id = auth.uid());

drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
	for insert
	with check (author_id = auth.uid());

drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts
	for update
	using (author_id = auth.uid())
	with check (author_id = auth.uid());

drop policy if exists likes_select on public.likes;
create policy likes_select on public.likes
	for select
	using (true);

drop policy if exists likes_insert on public.likes;
create policy likes_insert on public.likes
	for insert
	with check (user_id = auth.uid());

drop policy if exists likes_delete on public.likes;
create policy likes_delete on public.likes
	for delete
	using (user_id = auth.uid());

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
	for select
	using (deleted_at is null or author_id = auth.uid());

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
	for insert
	with check (author_id = auth.uid());

drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments
	for update
	using (author_id = auth.uid())
	with check (author_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

do $$ begin
	if not exists (
		select 1 from pg_policies
		where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_read'
	) then
		create policy avatars_read on storage.objects
			for select
			using (bucket_id = 'avatars');
	end if;
end $$;

do $$ begin
	if not exists (
		select 1 from pg_policies
		where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_insert'
	) then
		create policy avatars_insert on storage.objects
			for insert to authenticated
			with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
	end if;
end $$;

do $$ begin
	if not exists (
		select 1 from pg_policies
		where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_update'
	) then
		create policy avatars_update on storage.objects
			for update to authenticated
			using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
	end if;
end $$;

do $$ begin
	if not exists (
		select 1 from pg_policies
		where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_delete'
	) then
		create policy avatars_delete on storage.objects
			for delete to authenticated
			using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
	end if;
end $$;
