import { createClient } from '@supabase/supabase-js';

let supabaseServerClient = null;

function getSupabaseServerClient() {
  if (!supabaseServerClient) {
    supabaseServerClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return supabaseServerClient;
}

// Verifies the `Authorization: Bearer <token>` header against Supabase Auth.
// Returns the authenticated user on success, null on missing/invalid token.
export async function getAuthUser(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return null;
  }

  try {
    const { data, error } = await getSupabaseServerClient().auth.getUser(token);
    if (error || !data?.user) {
      return null;
    }
    return data.user;
  } catch {
    return null;
  }
}
