-- The Place filter and the museums page both key on location_taken, which had
-- no index — every lookup was a sequential scan.
--
-- At the archive's current size this changes little; 700-odd rows scan fast
-- enough that the query time is dominated by the network round trip. It is here
-- because the column is now a filter key, and the cost of adding it grows with
-- the table while the cost of forgetting does too.
create index if not exists photos_location_idx on photos (location_taken);
