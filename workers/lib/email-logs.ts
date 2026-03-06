import type { SupabaseClient } from '@supabase/supabase-js';

export type EmailLogStatus = 'queued' | 'sent' | 'failed' | 'skipped';

export function buildEmailPreview(html: string, maxLen = 160): string {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

export async function createEmailLog(
  supabase: SupabaseClient,
  payload: Record<string, any>
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('email_logs')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      console.error('email_logs insert error:', error);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    console.error('email_logs insert exception:', err);
    return null;
  }
}

export async function updateEmailLog(
  supabase: SupabaseClient,
  id: string,
  patch: Record<string, any>
): Promise<void> {
  try {
    const { error } = await supabase.from('email_logs').update(patch).eq('id', id);
    if (error) console.error('email_logs update error:', error);
  } catch (err) {
    console.error('email_logs update exception:', err);
  }
}
