export type Profile = {
	id: string;
	username: string;
	bio: string | null;
	avatar_url: string | null;
	created_at: string;
};

export type FeedPost = {
	id: number;
	author_id: string;
	body: string;
	edited_at: string | null;
	created_at: string;
	username: string;
	avatar_url: string | null;
	like_count: number;
	comment_count: number;
	liked_by_me: boolean;
};

export type Comment = {
	id: number;
	post_id: number;
	author_id: string;
	body: string;
	edited_at: string | null;
	created_at: string;
	profiles: { username: string; avatar_url: string | null } | null;
};

export const BODY_MAX = 500;
export const BIO_MAX = 200;
export const PAGE_SIZE = 20;
export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;
