create table if not exists public.follows (
	follower_id uuid not null references public.profiles (id) on delete cascade,
	followee_id uuid not null references public.profiles (id) on delete cascade,
	created_at timestamptz not null default now(),
	primary key (follower_id, followee_id),
	check (follower_id <> followee_id)
);

alter table public.follows enable row level security;

create or replace view public.following_feed with (security_invoker = true) as
select
	p.id,
	p.author_id,
	p.body,
	p.edited_at,
	p.created_at,
	pr.username,
	pr.avatar_url,
	p.like_count,
	p.comment_count,
	exists (
		select 1 from public.likes l
		where l.post_id = p.id and l.user_id = auth.uid()
	) as liked_by_me
from public.posts p
join public.profiles pr on pr.id = p.author_id
where p.deleted_at is null
	and (
		p.author_id = auth.uid()
		or exists (
			select 1 from public.follows f
			where f.follower_id = auth.uid() and f.followee_id = p.author_id
		)
	);

revoke all on public.follows from anon, authenticated;
revoke all on public.following_feed from anon, authenticated;

grant select on public.follows to anon, authenticated;
grant insert, delete on public.follows to authenticated;
grant select on public.following_feed to authenticated;

drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows
	for select to anon, authenticated
	using (true);

drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows
	for insert to authenticated
	with check (follower_id = auth.uid());

drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows
	for delete to authenticated
	using (follower_id = auth.uid());

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
	check (kind in ('like', 'comment', 'reply', 'mention', 'follow'));

create or replace function public.notify_follow_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
	insert into public.notifications (user_id, actor_id, kind)
	values (new.followee_id, new.follower_id, 'follow');

	return null;
end;
$$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
	after insert on public.follows
	for each row
	execute function public.notify_follow_created();

create or replace function public.delete_account(p_username text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
	v_uid uuid := auth.uid();
begin
	if v_uid is null then
		raise exception 'not signed in' using errcode = '42501';
	end if;

	if not exists (
		select 1 from public.profiles
		where id = v_uid and username = lower(trim(p_username))
	) then
		raise exception 'username mismatch' using errcode = '23514';
	end if;

	begin
		delete from storage.objects
		where bucket_id = 'avatars' and name like v_uid::text || '/%';
	exception
		when others then null;
	end;

	delete from auth.users where id = v_uid;
end;
$$;

alter table public.posts
	add column if not exists search tsvector
	generated always as (to_tsvector('russian', body)) stored;

create index if not exists posts_search_idx on public.posts using gin (search);

create or replace function public.search_posts(p_query text, p_cursor bigint default null)
returns table (
	id bigint,
	author_id uuid,
	body text,
	edited_at timestamptz,
	created_at timestamptz,
	username text,
	avatar_url text,
	like_count int,
	comment_count int,
	liked_by_me boolean
)
language sql
stable
as $$
	select
		p.id,
		p.author_id,
		p.body,
		p.edited_at,
		p.created_at,
		pr.username,
		pr.avatar_url,
		p.like_count,
		p.comment_count,
		exists (
			select 1 from public.likes l
			where l.post_id = p.id and l.user_id = auth.uid()
		) as liked_by_me
	from public.posts p
	join public.profiles pr on pr.id = p.author_id
	where p.deleted_at is null
		and p.search @@ websearch_to_tsquery('russian', p_query)
		and (p_cursor is null or p.id < p_cursor)
	order by p.id desc;
$$;

revoke all on function public.search_posts(text, bigint) from public;
grant execute on function public.search_posts(text, bigint) to anon, authenticated;

revoke all on function public.notify_follow_created() from public, anon;
revoke all on function public.delete_account(text) from public, anon;

grant execute on function public.notify_follow_created() to authenticated;
grant execute on function public.delete_account(text) to authenticated;
