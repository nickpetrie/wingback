-- Realtime publishes nothing unless a table is explicitly added to the
-- supabase_realtime publication, and none ever was — so every Realtime
-- subscription this app has shipped has been listening to a channel that
-- could not deliver. The goal toasts have never fired once.
--
-- picks is the only table anyone subscribes to: goals landing on it drive the
-- toasts, and a new row on it is someone making a pick, which is what lets
-- the other four appear on your screen without a refresh.
--
-- RLS still applies to Realtime, so this publishes nothing that the same
-- entrant could not already read: "picks are visible to all entrants" is the
-- policy doing the work, not the publication.
alter publication supabase_realtime add table picks;

-- Realtime sends the OLD row on an UPDATE only when the table has a replica
-- identity that includes the unchanged columns. Without this the goal toast
-- gets `old.goals` as undefined, reads the jump from nothing to one goal as
-- "no change", and stays silent — the failure it exists to prevent.
alter table picks replica identity full;
