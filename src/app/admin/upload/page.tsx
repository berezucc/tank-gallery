import { UploadZone } from '@/components/admin/UploadZone';

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-1 text-xl font-semibold">Upload photos</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Drag photos in, fill in the metadata, save each one. Phase 4 will pre-fill
        these fields automatically using Gemini.
      </p>
      <UploadZone />
    </main>
  );
}
