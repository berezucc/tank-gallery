import type { Metadata } from 'next';
import { IdentifyClient } from '@/components/identify/IdentifyClient';

export const metadata: Metadata = {
  title:       'Identify My Tank',
  description: 'Upload a photo of a military vehicle and let AI identify it.',
};

export default function IdentifyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Identify My Tank</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Upload a photo of a military vehicle — Gemini will try to identify the model,
        type, era, and nation of origin. Nothing is saved.
      </p>
      <div className="mt-8">
        <IdentifyClient />
      </div>
    </main>
  );
}
