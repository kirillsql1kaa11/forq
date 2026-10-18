export type Profile = {
	id: string;
	username: string;
	bio: string | null;
	avatar_url: string | null;
	pinned_post_id: number | null;
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
	pending?: boolean;
	cursor?: number;
};

export type Comment = {
	id: number;
	post_id: number;
	parent_id: number | null;
	author_id: string;
	body: string;
	edited_at: string | null;
	created_at: string;
	profiles: { username: string; avatar_url: string | null } | null;
};

export type NotificationKind = 'like' | 'comment' | 'reply' | 'mention' | 'follow';

export type Notification = {
	id: number;
	kind: NotificationKind;
	post_id: number | null;
	comment_id: number | null;
	read_at: string | null;
	created_at: string;
	actor_username: string;
	actor_avatar_url: string | null;
	post_body: string | null;
	comment_body: string | null;
};

export type MentionCandidate = {
	username: string;
	avatar_url: string | null;
};

export type ReplyPost = {
	body: string;
	deleted_at: string | null;
};

export type UserReply = {
	id: number;
	post_id: number;
	parent_id: number | null;
	body: string;
	created_at: string;
	posts: ReplyPost | null;
};

export type FollowCounts = {
	followers: number;
	following: number;
};

export type FollowPerson = {
	username: string;
	avatar_url: string | null;
	bio: string | null;
};

export const PEOPLE_TABS = ['followers', 'following'] as const;

export type PeopleTab = (typeof PEOPLE_TABS)[number];

export const PEOPLE_TAB_TEXT: Record<PeopleTab, string> = {
	followers: 'Подписчики',
	following: 'Подписки'
};

export const PROFILE_TABS = ['posts', 'replies', 'likes'] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number];

export const PROFILE_TAB_TEXT: Record<ProfileTab, string> = {
	posts: 'Посты',
	replies: 'Ответы',
	likes: 'Лайки'
};

export const BODY_MAX = 500;
export const BIO_MAX = 200;
export const PASSWORD_MIN = 6;
export const PAGE_SIZE = 20;
export const COMMENT_PAGE_SIZE = 10;
export const NOTIFICATION_PAGE_SIZE = 20;
export const PEOPLE_PAGE_SIZE = 30;
export const MENTION_SUGGESTIONS = 5;
export const TAG_MAX = 50;
export const SEARCH_MIN = 2;

export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;
export const MENTION_PATTERN = /@([a-z0-9_]{3,24})/gi;
export const TAG_PATTERN = /#([^\s#@,.;:!?()[\]{}<>«»"']+)/g;

export const NOTIFICATION_TEXT: Record<NotificationKind, string> = {
	like: 'отметил твой пост',
	comment: 'ответил на твой пост',
	reply: 'ответил на твой комментарий',
	mention: 'упомянул тебя',
	follow: 'подписался на тебя'
};

export const FEED_TABS = ['all', 'following'] as const;

export type FeedTab = (typeof FEED_TABS)[number];

export const FEED_TAB_TEXT: Record<FeedTab, string> = {
	all: 'Все',
	following: 'Подписки'
};
