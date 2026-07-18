import { supabase } from "@/utils/supabaseClient";

// Client-side fetch wrapper that attaches the current Supabase session's
// access token as an `Authorization: Bearer` header when one exists.
export async function apiFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();

  const headers = new Headers(options.headers || {});
  if (session?.access_token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(url, { ...options, headers });
}
