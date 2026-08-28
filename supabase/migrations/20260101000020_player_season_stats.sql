-- Season totals for the pick screen. Already in the bootstrap payload we
-- download and throw away, so mirroring them costs no extra FPL call.
--
-- Nullable on purpose: "we have not synced this yet" and "this player has
-- scored zero" are different answers, and a pick screen that invents a
-- confident 0 for a player whose stats never arrived is the spreadsheet
-- problem again. The UI renders null as "stats not synced yet", not "0".
alter table players
  add column goals_scored smallint,
  add column assists smallint,
  add column starts smallint,
  add column minutes integer;
