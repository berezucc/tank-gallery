// Create the admin auth user via the service-role key (bypasses email verification).
// Run with:
//   node --env-file=.env.local scripts/create-admin.mjs <email> <password>

import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error('Usage: node --env-file=.env.local scripts/create-admin.mjs <email> <password>');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

globalThis.WebSocket = WebSocket;

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  console.error('Failed:', error.message);
  process.exit(1);
}

console.log(`✓ Created admin user: ${data.user.email} (id: ${data.user.id})`);
console.log('You can now sign in at http://localhost:3000/admin/login');
