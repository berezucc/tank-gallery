-- The gallery has grown past land vehicles: naval subjects (battleships,
-- cruisers, submarines) previously had to be filed under 'other', which made
-- the type filter useless for them.
--
-- Note: ALTER TYPE ... ADD VALUE cannot be used by statements in the same
-- transaction that adds it, so this migration only adds the values. Rows using
-- them are inserted separately.

alter type vehicle_type add value if not exists 'ship';
alter type vehicle_type add value if not exists 'submarine';
