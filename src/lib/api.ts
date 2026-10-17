import { supabase } from './supabase';
import { PAGE_SIZE, type Comment, type FeedPost, type Profile } from './types';

type DbError = { code?: string; message: string };

export function errorMessage(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

function describe(error: DbError, kind: 'post' | 'comment' | 'username' | 'generic'): string {
	switch (error.code) {
		case '54000':
			return 'Слишком часто. Подожди минуту.';
		case '42501':
			return 'Нужно войти в аккаунт.';
		case '23514':
			return 'Текст пустой или длиннее 500 символов.';
		case '23505':
			return kind === 'username' ? 'Этот ник уже занят.' : 'Такая запись уже есть.';
		case '23503':
			return 'Сначала выбери ник для аккаунта.';
		default:
			return error.message;
	}
}

function unwrap<T>(data: T | null, error: DbError | null, kind: 'post' | 'comment' | 'username' | 'generic'): T {
	if (error) throw new Error(describe(error, kind));
	return data as T;
}

type CommentAuthor = NonNullable<Comment['profiles']>;

type CommentRow = Omit<Comment, 'profiles'> & {
	profiles: CommentAuthor | CommentAuthor[] | null;
};

function normalizeComment(row: CommentRow): Comment {
	const { profiles, ...rest } = row;
	return { ...rest, profiles: Array.isArray(profiles) ? (profiles[0] ?? null) : profiles };
}

export async function fetchFeed(cursor?: number): Promise<FeedPost[]> {
	let query = supabase.from('feed').select('*').order('id', { ascending: false }).limit(PAGE_SIZE);
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

export async function fetchComments(postId: number): Promise<Comment[]> {
	const { data, error } = await supabase
		.from('comments')
		.select('id, post_id, author_id, body, edited_at, created_at, profiles(username, avatar_url)')
		.eq('post_id', postId)
		.order('id');

	const rows = unwrap<unknown[]>(data, error, 'generic') ?? [];
	return rows.map((row) => normalizeComment(row as CommentRow));
}

export async function createComment(postId: number, authorId: string, body: string): Promise<void> {
	const { error } = await supabase
		.from('comments')
		.insert({ post_id: postId, author_id: authorId, body: body.trim() });

	if (error) throw new Error(describe(error, 'comment'));
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
		.select('id, username, bio, avatar_url, created_at')
		.eq('username', username)
		.maybeSingle();

	return unwrap<Profile | null>(data, error, 'generic');
}

export async function claimUsername(username: string): Promise<Profile> {
	const { data, error } = await supabase.rpc('claim_username', { p_username: username.toLowerCase() });
	return unwrap<Profile>(data, error, 'username');
}

export async function updateProfile(
	id: string,
	patch: { bio?: string | null; avatar_url?: string | null }
): Promise<void> {
	const { error } = await supabase.from('profiles').update(patch).eq('id', id);
	if (error) throw new Error(describe(error, 'generic'));
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
	const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';

	const { error } = await supabase.storage.from('avatars').upload(`${userId}/avatar.${extension}`, file, {
		upsert: true,
		contentType: file.type,
		cacheControl: '3600'
	});

	if (error) throw new Error(error.message);

	const { data } = supabase.storage.from('avatars').getPublicUrl(`${userId}/avatar.${extension}`);
	return `${data.publicUrl}?v=${Date.now()}`;
}
