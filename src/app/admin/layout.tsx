import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/admin/LogoutButton';

export const metadata: Metadata = {
  title:  'Admin',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen">
      {user && (
        <nav className="border-b border-zinc-800 bg-[#0a0a0a]">
          <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-6 py-3">
            <Link href="/admin" className="text-sm font-medium text-zinc-100 hover:text-white">
              Admin
            </Link>
            <Link href="/admin/upload" className="text-sm text-zinc-400 hover:text-zinc-100">
              Upload
            </Link>
            <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-100">
              ↗ View gallery
            </Link>
            <span className="ml-auto text-xs text-zinc-500">{user.email}</span>
            <LogoutButton />
          </div>
        </nav>
      )}
      {children}
    </div>
  );
}
