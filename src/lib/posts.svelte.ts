import { errorMessage, fetchPost } from './api';
import { PAGE_SIZE, type FeedPost } from './types';

export class PostList {
	items = $state<FeedPost[]>([]);
	loading = $state(true);
	loadingMore = $state(false);
	exhausted = $state(false);
	error = $state('');
	actionError = $state('');

	private loader: (cursor?: number) => Promise<FeedPost[]>;
	private lastTempId = 0;

	constructor(loader: (cursor?: number) => Promise<FeedPost[]>) {
		this.loader = loader;
	}

	async load(): Promise<void> {
		this.loading = true;
		this.error = '';

		try {
			const page = await this.loader();
			this.items = page;
			this.exhausted = page.length < PAGE_SIZE;
		} catch (cause) {
			this.error = errorMessage(cause);
		} finally {
			this.loading = false;
		}
	}

	async more(): Promise<void> {
		const last = this.items.filter((post) => !post.pending).at(-1);
		if (this.loadingMore || this.exhausted || last === undefined) return;

		this.loadingMore = true;

		try {
			const page = await this.loader(last.id);
			this.items = [...this.items, ...page];
			this.exhausted = page.length < PAGE_SIZE;
		} catch (cause) {
			this.actionError = errorMessage(cause);
		} finally {
			this.loadingMore = false;
		}
	}

	async prepend(postId: number): Promise<void> {
		const post = await fetchPost(postId);
		if (post) this.items = [post, ...this.items];
	}

	placeholder(body: string, authorId: string, username: string, avatarUrl: string | null): number {
		this.lastTempId -= 1;
		const id = this.lastTempId;

		this.exhausted = false;
		this.items = [
			{
				id,
				author_id: authorId,
				body,
				edited_at: null,
				created_at: new Date().toISOString(),
				username,
				avatar_url: avatarUrl,
				like_count: 0,
				comment_count: 0,
				liked_by_me: false,
				pending: true
			},
			...this.items
		];

		return id;
	}

	settle(tempId: number, realId: number): void {
		this.items = this.items.map((post) =>
			post.id === tempId ? { ...post, id: realId, pending: false } : post
		);
	}

	drop(id: number): void {
		this.items = this.items.filter((post) => post.id !== id);
	}

	markLike(id: number, liked: boolean): void {
		this.items = this.items.map((post) =>
			post.id === id
				? { ...post, liked_by_me: liked, like_count: post.like_count + (liked ? 1 : -1) }
				: post
		);
	}

	markBody(id: number, body: string, editedAt: string): void {
		this.items = this.items.map((post) => (post.id === id ? { ...post, body, edited_at: editedAt } : post));
	}

	markCommentCount(id: number, delta: number): void {
		this.items = this.items.map((post) =>
			post.id === id ? { ...post, comment_count: Math.max(0, post.comment_count + delta) } : post
		);
	}
}
