'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [busy,     setBusy]     = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    const next = searchParams.get('next') || '/admin';
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="email"
        required
        autoFocus
        autoComplete="email"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="block w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
      />
      <input
        type="password"
        required
        autoComplete="current-password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="block w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
