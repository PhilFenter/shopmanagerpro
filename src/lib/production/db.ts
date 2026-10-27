// The prod_* tables aren't in the generated Supabase types yet (types.ts is regenerated after
// Drew applies the migration). Until then the module uses an untyped view of the same client.
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const prodDb = supabase as unknown as SupabaseClient;

export const PROD_BUCKET = 'production-imports';

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await prodDb.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function signedUrl(path: string, seconds = 3600): Promise<string | null> {
  const { data } = await prodDb.storage.from(PROD_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

export async function signedUrls(paths: string[], seconds = 3600): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await prodDb.storage.from(PROD_BUCKET).createSignedUrls(paths, seconds);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

/** Upload, treating "already there" as success (paths are content hashes, so same path = same bytes). */
export async function uploadOnce(path: string, body: Blob | ArrayBuffer, contentType: string) {
  const { error } = await prodDb.storage.from(PROD_BUCKET).upload(path, body, { contentType, upsert: false });
  if (error && !/exists|duplicate/i.test(error.message)) throw new Error(`Upload failed: ${error.message}`);
}
