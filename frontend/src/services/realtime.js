import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const realtimeClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

export const subscribeToAccountChanges = ({ accessToken, accountId, userId, onChange }) => {
  if (!realtimeClient || !accessToken || !accountId) return () => {};

  realtimeClient.realtime.setAuth(accessToken);
  const channel = realtimeClient
    .channel(`account-live-${accountId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `account_id=eq.${accountId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts', filter: `id=eq.${accountId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'interest_postings', filter: `account_id=eq.${accountId}` }, onChange)
    .subscribe();

  return () => {
    realtimeClient.removeChannel(channel);
  };
};