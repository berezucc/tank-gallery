-- Public storage bucket for original photos and thumbnails.
-- Run this AFTER creating the bucket named "photos" via the Supabase dashboard
-- (Storage → New bucket → name: "photos", public: true).

-- Public read on the photos bucket
create policy "photos bucket is publicly readable"
  on storage.objects for select
  using (bucket_id = 'photos');

-- Authenticated upload / update / delete
create policy "authenticated users can upload to photos bucket"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos');

create policy "authenticated users can update photos bucket objects"
  on storage.objects for update to authenticated
  using (bucket_id = 'photos') with check (bucket_id = 'photos');

create policy "authenticated users can delete from photos bucket"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos');
