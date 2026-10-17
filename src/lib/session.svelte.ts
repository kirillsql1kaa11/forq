import type { User } from '@supabase/supabase-js';
import { fetchUnreadCount } from './api';
import { supabase } from './supabase';
import type { Profile } from './types';

class Session {
	user = $state<User | null>(null);
	profile = $state<Profile | null>(null);
	unread = $state(0);
	authReady = $state(false);
	profileReady = $state(false);

	private started = false;

	get ready(): boolean {
		return this.authReady && this.profileReady;
	}

	async start(): Promise<void> {
		if (this.started) return;
		this.started = true;

		const { data } = await supabase.auth.getSession();
		this.user = data.session?.user ?? null;
		this.authReady = true;
		await this.refreshProfile();
		await this.refreshUnread();

		supabase.auth.onAuthStateChange((_event, current) => {
			this.user = current?.user ?? null;
			this.authReady = true;
			this.profileReady = false;
			setTimeout(() => {
				void this.refreshProfile();
				void this.refreshUnread();
			}, 0);
		});
	}

	async refreshProfile(): Promise<void> {
		if (!this.user) {
			this.profile = null;
			this.profileReady = true;
			return;
		}

		const { data } = await supabase
			.from('profiles')
			.select('id, username, bio, avatar_url, created_at')
			.eq('id', this.user.id)
			.maybeSingle();

		this.profile = (data as Profile | null) ?? null;
		this.profileReady = true;
	}

	async refreshUnread(): Promise<void> {
		if (!this.user) {
			this.unread = 0;
			return;
		}

		try {
			this.unread = await fetchUnreadCount();
		} catch {
			this.unread = 0;
		}
	}
}

export const session = new Session();
