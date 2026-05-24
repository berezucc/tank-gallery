import { createClient } from '@supabase/supabase-js';

// Service-role client. Bypasses RLS — use ONLY in trusted server contexts
// (API routes, server actions) for admin uploads and management operations.
// Never import this from a Client Component.

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
