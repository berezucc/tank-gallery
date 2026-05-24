-- Photos table. Each row is a single image file; many photos can point at one vehicle.

create table photos (
  id              uuid primary key default gen_random_uuid(),
  vehicle_id      uuid not null references vehicles (id) on delete cascade,
  storage_path    text not null,
  thumbnail_path  text,
  blurhash        text,
  width           int,
  height          int,
  location_taken  text,
  date_taken      date,
  sort_order      int  not null default 0,
  ai_raw_response jsonb,
  created_at      timestamptz not null default now()
);

create index photos_vehicle_idx    on photos (vehicle_id);
create index photos_sort_order_idx on photos (vehicle_id, sort_order);
create index photos_created_idx    on photos (created_at desc);
