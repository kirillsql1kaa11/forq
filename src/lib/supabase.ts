import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$app/env/public';

export const configMissing = !PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(
	PUBLIC_SUPABASE_URL || 'https://unconfigured.invalid',
	PUBLIC_SUPABASE_ANON_KEY || 'unconfigured',
	{
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true
		}
	}
);
