import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if variables are missing or use default placeholders
export const isSupabaseConfigured = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseAnonKey !== 'placeholder-key'
);

if (!isSupabaseConfigured) {
  console.warn('Supabase URL or Anon Key is missing or using placeholder in environment variables.');
}

export const supabase = createClient(
  supabaseUrl || 'https://zoeobxnhcuzebtvzenke.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
