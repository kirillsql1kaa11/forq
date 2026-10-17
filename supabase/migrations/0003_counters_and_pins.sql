alter table public.posts
	add column if not exists like_count int not null default 0;

alter table public.posts
	add column if not exists comment_count int not null default 0;

alter table public.likes
	add column if not exists id bigint generated always as identity;

create unique index if not exists likes_id_idx on public.likes (id);

alter table public.profiles
	add column if not exists pinned_post_id bigint references public.posts (id) on delete set null;

grant update (pinned_post_id) on public.profiles to authenticated;

update public.posts p
set like_count = (select count(*) from public.likes l where l.post_id = p.id),
	comment_count = (
		select count(*) from public.comments c
		where c.post_id = p.id and c.deleted_at is null
	);

create or replace function public.sync_like_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
	if tg_op = 'INSERT' then
		update public.posts set like_count = like_count + 1 where id = new.post_id;
		return null;
	end if;

	update public.posts set like_count = greatest(0, like_count - 1) where id = old.post_id;

	return null;
end;
$$;

create or replace function public.sync_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
	if tg_op = 'INSERT' then
		if new.deleted_at is null then
			update public.posts set comment_count = comment_count + 1 where id = new.post_id;
		end if;

		return null;
	end if;

	if tg_op = 'DELETE' then
		if old.deleted_at is null then
			update public.posts
			set comment_count = greatest(0, comment_count - 1)
			where id = old.post_id;
		end if;

		return null;
	end if;

	if old.deleted_at is null and new.deleted_at is not null then
		update public.posts
		set comment_count = greatest(0, comment_count - 1)
		where id = new.post_id;
	elsif old.deleted_at is not null and new.deleted_at is null then
		update public.posts set comment_count = comment_count + 1 where id = new.post_id;
	end if;

	return null;
end;
$$;

create or replace function public.enforce_pinned_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
	if new.pinned_post_id is null then
		return new;
	end if;

	if not exists (
		select 1 from public.posts
		where id = new.pinned_post_id and author_id = new.id and deleted_at is null
	) then
		raise exception 'pinned post must be yours' using errcode = '23514';
	end if;

	return new;
end;
$$;

create or replace function public.clear_pinned_post()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
	if new.deleted_at is not null and old.deleted_at is null then
		update public.profiles set pinned_post_id = null where pinned_post_id = new.id;
	end if;

	return null;
end;
$$;

drop trigger if exists likes_sync_count on public.likes;
create trigger likes_sync_count
	after insert or delete on public.likes
	for each row
	execute function public.sync_like_count();

drop trigger if exists comments_sync_count on public.comments;
create trigger comments_sync_count
	after insert or delete or update on public.comments
	for each row
	execute function public.sync_comment_count();

drop trigger if exists posts_clear_pin on public.posts;
create trigger posts_clear_pin
	after update on public.posts
	for each row
	execute function public.clear_pinned_post();

drop trigger if exists profiles_pinned_owner on public.profiles;
create trigger profiles_pinned_owner
	before update of pinned_post_id on public.profiles
	for each row
	execute function public.enforce_pinned_owner();

create or replace view public.feed with (security_invoker = true) as
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
where p.deleted_at is null;

revoke all on function public.sync_like_count() from public, anon;
revoke all on function public.sync_comment_count() from public, anon;
revoke all on function public.enforce_pinned_owner() from public, anon;
revoke all on function public.clear_pinned_post() from public, anon;

grant execute on function public.sync_like_count() to authenticated;
grant execute on function public.sync_comment_count() to authenticated;
grant execute on function public.enforce_pinned_owner() to authenticated;
grant execute on function public.clear_pinned_post() to authenticated;
