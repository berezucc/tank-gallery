-- Row-level security: public can read everything, only authenticated users can write.
-- The "authenticated" role here corresponds to the admin (only one user logs in via Supabase Auth).

alter table vehicles enable row level security;
alter table photos   enable row level security;

-- Public read
create policy "vehicles are publicly readable"
  on vehicles for select
  using (true);

create policy "photos are publicly readable"
  on photos for select
  using (true);

-- Authenticated write (admin)
create policy "authenticated users can insert vehicles"
  on vehicles for insert to authenticated
  with check (true);

create policy "authenticated users can update vehicles"
  on vehicles for update to authenticated
  using (true) with check (true);

create policy "authenticated users can delete vehicles"
  on vehicles for delete to authenticated
  using (true);

create policy "authenticated users can insert photos"
  on photos for insert to authenticated
  with check (true);

create policy "authenticated users can update photos"
  on photos for update to authenticated
  using (true) with check (true);

create policy "authenticated users can delete photos"
  on photos for delete to authenticated
  using (true);
