import { supabase } from './supabase';
import {
	COMMENT_PAGE_SIZE,
	MENTION_SUGGESTIONS,
	NOTIFICATION_PAGE_SIZE,
	PAGE_SIZE,
	SEARCH_MIN,
	type Comment,
	type FeedPost,
	type MentionCandidate,
	type Notification,
	type Profile,
	type ReplyPost,
	type UserReply
} from './types';

type DbError = { code?: string; message: string };
type ErrorKind = 'post' | 'comment' | 'username' | 'pin' | 'account' | 'generic';

const AUTH_MESSAGES: [string, string][] = [
	['invalid login credentials', 'Неверная почта или пароль.'],
	['email not confirmed', 'Почта ещё не подтверждена. Проверь письмо.'],
	['user already registered', 'Такая почта уже зарегистрирована.'],
	['password should be at least', 'Пароль слишком короткий.'],
	['new password should be different', 'Новый пароль совпадает со старым.'],
	['auth session missing', 'Ссылка устарела. Запроси новую.'],
	['token has expired', 'Ссылка устарела. Запроси новую.'],
	['unable to validate email', 'Почта выглядит некорректно.'],
	['email address not authorized', 'Письмо не ушло: адрес не разрешён настройками SMTP.'],
	['for security purposes', 'Слишком часто. Подожди немного и попробуй снова.'],
	['rate limit', 'Слишком много попыток. Подожди немного.'],
	['failed to fetch', 'Нет связи с сервером. Проверь интернет.']
];

export function errorMessage(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

export function authMessage(error: { message: string }): string {
	const text = error.message.toLowerCase();
	const match = AUTH_MESSAGES.find(([needle]) => text.includes(needle));
	return match ? match[1] : error.message;
}

function describe(error: DbError, kind: ErrorKind): string {
	switch (error.code) {
		case '54000':
			return 'Слишком часто. Подожди минуту.';
		case '42501':
			return 'Нужно войти в аккаунт.';
		case '23514':
			if (kind === 'pin') return 'Закрепить можно только свой неудалённый пост.';
			if (kind === 'account') return 'Ник не совпал. Введи свой ник точно.';
			return kind === 'comment' ? 'Ответ пустой или длиннее 500 символов.' : 'Текст пустой или длиннее 500 символов.';
		case '23505':
			return kind === 'username' ? 'Этот ник уже занят.' : 'Такая запись уже есть.';
		case '23503':
			return 'Сначала выбери ник для аккаунта.';
		default:
			return error.message;
	}
}

function unwrap<T>(data: T | null, error: DbError | null, kind: ErrorKind): T {
	if (error) throw new Error(describe(error, kind));
	return data as T;
}

type CommentAuthor = NonNullable<Comment['profiles']>;

type CommentRow = Omit<Comment, 'profiles'> & {
	profiles: CommentAuthor | CommentAuthor[] | null;
};

const COMMENT_COLUMNS =
	'id, post_id, parent_id, author_id, body, edited_at, created_at, profiles(username, avatar_url)';

function normalizeComment(row: CommentRow): Comment {
	const { profiles, ...rest } = row;
	return { ...rest, profiles: Array.isArray(profiles) ? (profiles[0] ?? null) : profiles };
}

function toComments(data: unknown[] | null, error: DbError | null): Comment[] {
	const rows = unwrap<unknown[]>(data, error, 'generic') ?? [];
	return rows.map((row) => normalizeComment(row as CommentRow));
}

export async function fetchFeed(cursor?: number): Promise<FeedPost[]> {
	let query = supabase.from('feed').select('*').order('id', { ascending: false }).limit(PAGE_SIZE);
	if (cursor !== undefined) query = query.lt('id', cursor);

	const { data, error } = await query;
	return unwrap<FeedPost[]>(data, error, 'generic') ?? [];
}

export async function fetchFollowingFeed(cursor?: number): Promise<FeedPost[]> {
	let query = supabase
		.from('following_feed')
		.select('*')
		.order('id', { ascending: false })
		.limit(PAGE_SIZE);
	if (cursor !== undefined) query = query.lt('id', cursor);

	const { data, error } = await query;
	return unwrap<FeedPost[]>(data, error, 'generic') ?? [];
}

export async function fetchUserPosts(authorId: string, cursor?: number): Promise<FeedPost[]> {
	let query = supabase
		.from('feed')
		.select('*')
		.eq('author_id', authorId)
		.order('id', { ascending: false })
		.limit(PAGE_SIZE);
	if (cursor !== undefined) query = query.lt('id', cursor);

	const { data, error } = await query;
	return unwrap<FeedPost[]>(data, error, 'generic') ?? [];
}

async function postsByIds(ids: number[]): Promise<FeedPost[]> {
	const { data, error } = await supabase
		.from('feed')
		.select('*')
		.in('id', ids)
		.order('id', { ascending: false });

	return unwrap<FeedPost[]>(data, error, 'generic') ?? [];
}

export async function fetchTagFeed(tag: string, cursor?: number): Promise<FeedPost[]> {
	let query = supabase
		.from('post_tags')
		.select('post_id')
		.eq('tag', tag)
		.order('post_id', { ascending: false })
		.limit(PAGE_SIZE);
	if (cursor !== undefined) query = query.lt('post_id', cursor);

	const { data, error } = await query;
	const rows = unwrap<{ post_id: number }[]>(data, error, 'generic') ?? [];
	if (rows.length === 0) return [];

	return postsByIds(rows.map((row) => row.post_id));
}

type LikeRow = { id: number; post_id: number };

async function likeRows(userId: string, cursor?: number): Promise<LikeRow[]> {
	let query = supabase
		.from('likes')
		.select('id, post_id')
		.eq('user_id', userId)
		.order('id', { ascending: false })
		.limit(PAGE_SIZE);
	if (cursor !== undefined) query = query.lt('id', cursor);

	const { data, error } = await query;
	return unwrap<LikeRow[]>(data, error, 'generic') ?? [];
}

export async function fetchLikedPosts(userId: string, cursor?: number): Promise<FeedPost[]> {
	const result: FeedPost[] = [];
	let after = cursor;

	while (result.length < PAGE_SIZE) {
		const rows = await likeRows(userId, after);
		if (rows.length === 0) break;

		const found = await postsByIds(rows.map((row) => row.post_id));
		const byId = new Map(found.map((post) => [post.id, post]));

		for (const row of rows) {
			const post = byId.get(row.post_id);
			if (post) result.push({ ...post, cursor: row.id });
		}

		const tail = rows[rows.length - 1];
		after = tail.id;

		const last = result[result.length - 1];
		if (last) result[result.length - 1] = { ...last, cursor: tail.id };

		if (rows.length < PAGE_SIZE) break;
	}

	return result;
}

type ReplyRow = Omit<UserReply, 'posts'> & {
	posts: ReplyPost | ReplyPost[] | null;
};

function normalizeReply(row: ReplyRow): UserReply {
	const { posts, ...rest } = row;
	return { ...rest, posts: Array.isArray(posts) ? (posts[0] ?? null) : posts };
}

export async function fetchUserReplies(authorId: string, cursor?: number): Promise<UserReply[]> {
	let query = supabase
		.from('comments')
		.select('id, post_id, parent_id, body, created_at, posts(body, deleted_at)')
		.eq('author_id', authorId)
		.is('deleted_at', null)
		.order('id', { ascending: false })
		.limit(PAGE_SIZE);
	if (cursor !== undefined) query = query.lt('id', cursor);

	const { data, error } = await query;
	const rows = unwrap<unknown[]>(data, error, 'generic') ?? [];
	return rows.map((row) => normalizeReply(row as ReplyRow));
}

export async function fetchPost(id: number): Promise<FeedPost | null> {
	const { data, error } = await supabase.from('feed').select('*').eq('id', id).maybeSingle();
	return unwrap<FeedPost | null>(data, error, 'generic');
}

export async function createPost(body: string, authorId: string): Promise<number> {
	const { data, error } = await supabase
		.from('posts')
		.insert({ body: body.trim(), author_id: authorId })
		.select('id')
		.single();

	const row = unwrap<{ id: number } | null>(data, error, 'post');
	if (!row) throw new Error('Пост не сохранился.');
	return row.id;
}

export async function editPost(id: number, body: string): Promise<void> {
	const { error } = await supabase.from('posts').update({ body: body.trim() }).eq('id', id);
	if (error) throw new Error(describe(error, 'post'));
}

export async function deletePost(id: number): Promise<void> {
	const { error } = await supabase
		.from('posts')
		.update({ deleted_at: new Date().toISOString() })
		.eq('id', id);
	if (error) throw new Error(describe(error, 'post'));
}

export async function setLike(postId: number, userId: string, liked: boolean): Promise<void> {
	const result = liked
		? await supabase.from('likes').insert({ post_id: postId, user_id: userId })
		: await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId);

	if (result.error && result.error.code !== '23505') {
		throw new Error(describe(result.error, 'generic'));
	}
}

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
	const { data, error } = await supabase
		.from('follows')
		.select('followee_id')
		.eq('follower_id', followerId)
		.eq('followee_id', followeeId)
		.maybeSingle();

	if (error) throw new Error(describe(error, 'generic'));
	return data !== null;
}

export async function setFollow(
	followerId: string,
	followeeId: string,
	following: boolean
): Promise<void> {
	const result = following
		? await supabase.from('follows').insert({ follower_id: followerId, followee_id: followeeId })
		: await supabase
				.from('follows')
				.delete()
				.eq('follower_id', followerId)
				.eq('followee_id', followeeId);

	if (result.error && result.error.code !== '23505') {
		throw new Error(describe(result.error, 'generic'));
	}
}

export async function searchPosts(term: string, cursor?: number): Promise<FeedPost[]> {
	const cleaned = term.trim();
	if (cleaned.length < SEARCH_MIN) return [];

	const { data, error } = await supabase
		.rpc('search_posts', { p_query: cleaned, p_cursor: cursor ?? null })
		.limit(PAGE_SIZE);

	return unwrap<FeedPost[]>(data, error, 'generic') ?? [];
}

export async function deleteAccount(username: string): Promise<void> {
	const { error } = await supabase.rpc('delete_account', { p_username: username });
	if (error) throw new Error(describe(error, 'account'));
}

export async function fetchComments(postId: number, cursor?: number): Promise<Comment[]> {
	let query = supabase
		.from('comments')
		.select(COMMENT_COLUMNS)
		.eq('post_id', postId)
		.is('parent_id', null)
		.order('id', { ascending: false })
		.limit(COMMENT_PAGE_SIZE);
	if (cursor !== undefined) query = query.lt('id', cursor);

	const { data, error } = await query;
	return toComments(data, error);
}

export async function fetchReplies(postId: number, parentIds: number[]): Promise<Comment[]> {
	if (parentIds.length === 0) return [];

	const { data, error } = await supabase
		.from('comments')
		.select(COMMENT_COLUMNS)
		.eq('post_id', postId)
		.in('parent_id', parentIds)
		.order('id');

	return toComments(data, error);
}

export async function createComment(
	postId: number,
	authorId: string,
	body: string,
	parentId: number | null = null
): Promise<Comment> {
	const { data, error } = await supabase
		.from('comments')
		.insert({ post_id: postId, author_id: authorId, body: body.trim(), parent_id: parentId })
		.select(COMMENT_COLUMNS)
		.single();

	const row = unwrap<unknown>(data, error, 'comment');
	if (!row) throw new Error('Ответ не сохранился.');
	return normalizeComment(row as CommentRow);
}

export async function deleteComment(id: number): Promise<void> {
	const { error } = await supabase
		.from('comments')
		.update({ deleted_at: new Date().toISOString() })
		.eq('id', id);

	if (error) throw new Error(describe(error, 'comment'));
}

export async function fetchProfile(username: string): Promise<Profile | null> {
	const { data, error } = await supabase
		.from('profiles')
		.select('id, username, bio, avatar_url, pinned_post_id, created_at')
		.eq('username', username)
		.maybeSingle();

	return unwrap<Profile | null>(data, error, 'generic');
}

export async function claimUsername(username: string): Promise<Profile> {
	const { data, error } = await supabase.rpc('claim_username', { p_username: username.toLowerCase() });
	return unwrap<Profile>(data, error, 'username');
}

export async function searchProfiles(prefix: string): Promise<MentionCandidate[]> {
	const cleaned = prefix.toLowerCase().replace(/[^a-z0-9_]/g, '');
	if (cleaned.length === 0) return [];

	const { data, error } = await supabase
		.from('profiles')
		.select('username, avatar_url')
		.like('username', `${cleaned}%`)
		.order('username')
		.limit(MENTION_SUGGESTIONS);

	return unwrap<MentionCandidate[]>(data, error, 'generic') ?? [];
}

export async function updateProfile(
	id: string,
	patch: { bio?: string | null; avatar_url?: string | null }
): Promise<void> {
	const { error } = await supabase.from('profiles').update(patch).eq('id', id);
	if (error) throw new Error(describe(error, 'generic'));
}

export async function setPinnedPost(userId: string, postId: number | null): Promise<void> {
	const { error } = await supabase
		.from('profiles')
		.update({ pinned_post_id: postId })
		.eq('id', userId);

	if (error) throw new Error(describe(error, 'pin'));
}

export async function fetchNotifications(cursor?: number): Promise<Notification[]> {
	let query = supabase
		.from('notifications_feed')
		.select(
			'id, kind, post_id, comment_id, read_at, created_at, actor_username, actor_avatar_url, post_body, comment_body'
		)
		.order('id', { ascending: false })
		.limit(NOTIFICATION_PAGE_SIZE);
	if (cursor !== undefined) query = query.lt('id', cursor);

	const { data, error } = await query;
	return unwrap<Notification[]>(data, error, 'generic') ?? [];
}

export async function fetchUnreadCount(): Promise<number> {
	const { count, error } = await supabase
		.from('notifications')
		.select('id', { count: 'exact', head: true })
		.is('read_at', null);

	if (error) throw new Error(describe(error, 'generic'));
	return count ?? 0;
}

export async function markNotificationsRead(): Promise<void> {
	const { error } = await supabase
		.from('notifications')
		.update({ read_at: new Date().toISOString() })
		.is('read_at', null);

	if (error) throw new Error(describe(error, 'generic'));
}

export async function sendPasswordReset(email: string, redirectTo: string): Promise<void> {
	const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
	if (error) throw new Error(authMessage(error));
}

export async function changePassword(password: string): Promise<void> {
	const { error } = await supabase.auth.updateUser({ password });
	if (error) throw new Error(authMessage(error));
}

export async function signOut(): Promise<void> {
	const { error } = await supabase.auth.signOut();
	if (error) throw new Error(authMessage(error));
}

export async function uploadAvatar(userId: string, image: { blob: Blob; extension: string }): Promise<string> {
	const name = `avatar.${image.extension}`;
	const path = `${userId}/${name}`;

	const { error } = await supabase.storage.from('avatars').upload(path, image.blob, {
		upsert: true,
		contentType: image.blob.type,
		cacheControl: '3600'
	});

	if (error) throw new Error(error.message);

	const { data: listing } = await supabase.storage.from('avatars').list(userId, { limit: 100 });
	const stale = (listing ?? [])
		.filter((item) => item.name !== name)
		.map((item) => `${userId}/${item.name}`);

	if (stale.length > 0) await supabase.storage.from('avatars').remove(stale);

	const { data } = supabase.storage.from('avatars').getPublicUrl(path);
	return `${data.publicUrl}?v=${Date.now()}`;
}
