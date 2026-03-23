/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn('Supabase URL or Anon Key is missing. Please check your environment variables in AI Studio Settings.');
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Test connection on startup
if (isSupabaseConfigured) {
  supabase.from('users').select('id', { count: 'exact', head: true }).limit(1)
    .then(({ error }) => {
      if (error) {
        if (error.message === 'TypeError: Failed to fetch') {
          console.error('❌ Supabase connection failed: Network error. Check your VITE_SUPABASE_URL.');
        } else if (error.code === 'PGRST116' || error.message.includes('relation "public.users" does not exist')) {
          console.warn('⚠️ Supabase connected, but the "users" table was not found. Please run the SQL script in your Supabase dashboard.');
        } else {
          console.error('❌ Supabase connection error:', error.message);
        }
      } else {
        console.log('✅ Supabase connection established successfully!');
      }
    });
}
