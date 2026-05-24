-- Geocoded coordinates per photo. Populated by scripts/geocode.mjs which
-- looks up `location_taken` strings against Nominatim (OpenStreetMap).
-- Null for any photo whose location is unknown or hasn't been geocoded yet.

alter table photos
  add column lat double precision,
  add column lng double precision;

create index photos_geo_idx on photos (lat, lng);
