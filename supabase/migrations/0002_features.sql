alter table public.comments
	add column if not exists parent_id bigint references public.comments (id) on delete set null;

create index if not exists comments_parent_idx on public.comments (parent_id) where deleted_at is null;
create index if not exists comments_author_idx on public.comments (author_id, created_at desc);

create or replace function public.enforce_post_rate()
returns trigger
language plpgsql
as $$
declare
	v_recent int;
begin
	perform pg_advisory_xact_lock(hashtextextended('posts:' || new.author_id::text, 0));

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

create or replace function public.enforce_like_rate()
returns trigger
language plpgsql
as $$
declare
	v_recent int;
begin
	perform pg_advisory_xact_lock(hashtextextended('likes:' || new.user_id::text, 0));

	select count(*) into v_recent
	from public.likes
	where user_id = new.user_id
		and created_at > now() - interval '1 minute';

	if v_recent >= 30 then
		raise exception 'rate limit exceeded' using errcode = '54000';
	end if;

	return new;
end;
$$;

create or replace function public.enforce_comment_rate()
returns trigger
language plpgsql
as $$
declare
	v_recent int;
begin
	perform pg_advisory_xact_lock(hashtextextended('comments:' || new.author_id::text, 0));

	select count(*) into v_recent
	from public.comments
	where author_id = new.author_id
		and created_at > now() - interval '1 minute';

	if v_recent >= 10 then
		raise exception 'rate limit exceeded' using errcode = '54000';
	end if;

	return new;
end;
$$;

drop trigger if exists likes_rate_limit on public.likes;
create trigger likes_rate_limit
	before insert on public.likes
	for each row
	execute function public.enforce_like_rate();

drop trigger if exists comments_rate_limit on public.comments;
create trigger comments_rate_limit
	before insert on public.comments
	for each row
	execute function public.enforce_comment_rate();

create or replace function public.enforce_comment_depth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
	v_parent public.comments;
begin
	if new.parent_id is null then
		return new;
	end if;

	select * into v_parent from public.comments where id = new.parent_id;

	if v_parent.id is null then
		raise exception 'parent comment not found' using errcode = '23503';
	end if;

	if v_parent.post_id <> new.post_id then
		raise exception 'parent comment belongs to another post' using errcode = '23514';
	end if;

	if v_parent.parent_id is not null then
		new.parent_id := v_parent.parent_id;
	end if;

	return new;
end;
$$;

create or replace function public.cascade_comment_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
	if new.deleted_at is not null and old.deleted_at is null then
		update public.comments
		set deleted_at = new.deleted_at
		where parent_id = new.id and deleted_at is null;
	end if;

	return null;
end;
$$;

drop trigger if exists comments_depth on public.comments;
create trigger comments_depth
	before insert or update of parent_id on public.comments
	for each row
	execute function public.enforce_comment_depth();

drop trigger if exists comments_cascade_delete on public.comments;
create trigger comments_cascade_delete
	after update on public.comments
	for each row
	execute function public.cascade_comment_delete();

create table if not exists public.notifications (
	id bigint generated always as identity primary key,
	user_id uuid not null references public.profiles (id) on delete cascade,
	actor_id uuid not null references public.profiles (id) on delete cascade,
	kind text not null check (kind in ('like', 'comment', 'reply', 'mention')),
	post_id bigint references public.posts (id) on delete cascade,
	comment_id bigint references public.comments (id) on delete cascade,
	read_at timestamptz,
	created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, id desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

create or replace function public.notify_mentions(
	p_actor uuid,
	p_post_id bigint,
	p_comment_id bigint,
	p_body text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
	insert into public.notifications (user_id, actor_id, kind, post_id, comment_id)
	select distinct pr.id, p_actor, 'mention', p_post_id, p_comment_id
	from regexp_matches(p_body, '@([A-Za-z0-9_]{3,24})', 'g') as m
	join public.profiles pr on pr.username = lower(m[1])
	where pr.id <> p_actor;
end;
$$;

create or replace function public.notify_post_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
	perform public.notify_mentions(new.author_id, new.id, null, new.body);
	return null;
end;
$$;

create or replace function public.notify_like_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
	v_author uuid;
begin
	select author_id into v_author from public.posts where id = new.post_id;

	if v_author is null or v_author = new.user_id then
		return null;
	end if;

	if exists (
		select 1 from public.notifications
		where user_id = v_author and actor_id = new.user_id and kind = 'like' and post_id = new.post_id
	) then
		return null;
	end if;

	insert into public.notifications (user_id, actor_id, kind, post_id)
	values (v_author, new.user_id, 'like', new.post_id);

	return null;
end;
$$;

create or replace function public.notify_comment_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
	v_post_author uuid;
	v_parent_author uuid;
begin
	select author_id into v_post_author from public.posts where id = new.post_id;

	if v_post_author is not null and v_post_author <> new.author_id then
		insert into public.notifications (user_id, actor_id, kind, post_id, comment_id)
		values (
			v_post_author,
			new.author_id,
			case when new.parent_id is null then 'comment' else 'reply' end,
			new.post_id,
			new.id
		);
	end if;

	if new.parent_id is not null then
		select author_id into v_parent_author from public.comments where id = new.parent_id;

		if v_parent_author is not null
			and v_parent_author <> new.author_id
			and v_parent_author <> v_post_author then
			insert into public.notifications (user_id, actor_id, kind, post_id, comment_id)
			values (v_parent_author, new.author_id, 'reply', new.post_id, new.id);
		end if;
	end if;

	perform public.notify_mentions(new.author_id, new.post_id, new.id, new.body);

	return null;
end;
$$;

drop trigger if exists posts_notify on public.posts;
create trigger posts_notify
	after insert on public.posts
	for each row
	execute function public.notify_post_created();

drop trigger if exists likes_notify on public.likes;
create trigger likes_notify
	after insert on public.likes
	for each row
	execute function public.notify_like_created();

drop trigger if exists comments_notify on public.comments;
create trigger comments_notify
	after insert on public.comments
	for each row
	execute function public.notify_comment_created();

create table if not exists public.post_tags (
	post_id bigint not null references public.posts (id) on delete cascade,
	tag text not null check (char_length(tag) between 1 and 50),
	primary key (post_id, tag)
);

create index if not exists post_tags_tag_idx on public.post_tags (tag, post_id desc);

create or replace function public.sync_post_tags()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
	delete from public.post_tags where post_id = new.id;

	insert into public.post_tags (post_id, tag)
	select distinct new.id, lower(m[1])
	from regexp_matches(new.body, $re$#([^\s#@,.;:!?()[\]{}<>«»"']+)$re$, 'g') as m
	where char_length(m[1]) between 1 and 50
	limit 20;

	return null;
end;
$$;

drop trigger if exists posts_sync_tags on public.posts;
create trigger posts_sync_tags
	after insert or update of body on public.posts
	for each row
	execute function public.sync_post_tags();

insert into public.post_tags (post_id, tag)
select distinct p.id, lower(m[1])
from public.posts p,
	regexp_matches(p.body, $re$#([^\s#@,.;:!?()[\]{}<>«»"']+)$re$, 'g') as m
where p.deleted_at is null
	and char_length(m[1]) between 1 and 50
on conflict do nothing;

create or replace view public.notifications_feed with (security_invoker = true) as
select
	n.id,
	n.user_id,
	n.actor_id,
	n.kind,
	n.post_id,
	n.comment_id,
	n.read_at,
	n.created_at,
	pr.username as actor_username,
	pr.avatar_url as actor_avatar_url,
	p.body as post_body,
	c.body as comment_body
from public.notifications n
join public.profiles pr on pr.id = n.actor_id
left join public.posts p on p.id = n.post_id
left join public.comments c on c.id = n.comment_id;

alter table public.notifications enable row level security;
alter table public.post_tags enable row level security;

revoke all on public.notifications, public.notifications_feed, public.post_tags
	from anon, authenticated;

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.notifications_feed to authenticated;
grant select on public.post_tags to anon, authenticated;

revoke all on function public.enforce_like_rate() from public, anon;
revoke all on function public.enforce_comment_rate() from public, anon;
revoke all on function public.enforce_comment_depth() from public, anon;
revoke all on function public.cascade_comment_delete() from public, anon;
revoke all on function public.notify_mentions(uuid, bigint, bigint, text) from public, anon;
revoke all on function public.notify_post_created() from public, anon;
revoke all on function public.notify_like_created() from public, anon;
revoke all on function public.notify_comment_created() from public, anon;
revoke all on function public.sync_post_tags() from public, anon;

grant execute on function public.enforce_like_rate() to authenticated;
grant execute on function public.enforce_comment_rate() to authenticated;
grant execute on function public.enforce_comment_depth() to authenticated;
grant execute on function public.cascade_comment_delete() to authenticated;
grant execute on function public.notify_post_created() to authenticated;
grant execute on function public.notify_like_created() to authenticated;
grant execute on function public.notify_comment_created() to authenticated;
grant execute on function public.sync_post_tags() to authenticated;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
	for select to authenticated
	using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
	for update to authenticated
	using (user_id = auth.uid())
	with check (user_id = auth.uid());

drop policy if exists post_tags_select on public.post_tags;
create policy post_tags_select on public.post_tags
	for select
	using (true);

update storage.buckets
set file_size_limit = 2097152,
	allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'avatars';
