-- Profile pictures. Public bucket (these are five friends' photos, not
-- sensitive) so the app can just build a public URL rather than juggling
-- signed URLs. Object name is the entrant's id — one object per entrant,
-- `upsert: true` on the client lets them replace it any time.
--
-- This migration needs Supabase's storage schema, which only exists on an
-- actual Supabase project — it's deliberately excluded from the local
-- pgTAP harness (see supabase/tests/run.sh).

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar owner can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and name = (select current_entrant_id())::text);

create policy "avatar owner can replace" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and name = (select current_entrant_id())::text);

create policy "avatar owner can remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and name = (select current_entrant_id())::text);
