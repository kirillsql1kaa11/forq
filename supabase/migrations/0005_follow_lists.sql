create index if not exists follows_followee_idx
	on public.follows (followee_id, created_at desc, follower_id);

create index if not exists follows_follower_idx
	on public.follows (follower_id, created_at desc, followee_id);
