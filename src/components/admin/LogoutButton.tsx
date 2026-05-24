'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();

  async function onClick() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <button
      onClick={onClick}
      className="text-xs text-zinc-400 underline-offset-4 hover:text-zinc-100 hover:underline"
    >
      Sign out
    </button>
  );
}
