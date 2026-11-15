-- Who was operating this particular example, when it differs from the
-- vehicle's nation of origin: a captured T-34 in Finnish markings stays a
-- USSR vehicle (so the nation filter and stats are unchanged) while its
-- photos show the Finnish flag beside the Soviet one. Null for the usual case.

alter table photos
  add column operator text;
