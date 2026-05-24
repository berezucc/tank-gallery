-- Vehicle metadata. One row per distinct vehicle (e.g. "M4 Sherman").
-- Multiple photos can reference the same vehicle.

create type vehicle_type as enum ('tank', 'aircraft', 'artillery', 'vehicle', 'other');
create type vehicle_era  as enum ('ww1', 'ww2', 'cold_war', 'modern', 'other');

create table vehicles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        vehicle_type not null default 'other',
  era         vehicle_era  not null default 'other',
  nation      text,
  created_at  timestamptz not null default now()
);

create index vehicles_type_idx   on vehicles (type);
create index vehicles_era_idx    on vehicles (era);
create index vehicles_nation_idx on vehicles (nation);
