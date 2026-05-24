import { Suspense } from 'react';
import { LoginForm } from '@/components/admin/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold">Admin login</h1>
        <p className="mb-8 text-sm text-zinc-500">Sign in to manage the gallery.</p>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
