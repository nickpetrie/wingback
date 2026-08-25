-- Avatar uploads were failing for everyone with "new row violates row-level
-- security policy", even though the INSERT policy's WITH CHECK evaluates true
-- for the uploader.
--
-- The cause is RETURNING, not the check: storage-api always writes objects with
--
--   insert into storage.objects (...) values (...)
--   on conflict (name, bucket_id) do update set ... returning *
--
-- and Postgres applies SELECT policies to rows a RETURNING clause produces. The
-- bucket has no SELECT policy, so the insert itself succeeds and then handing
-- the row back fails — reported, confusingly, as the WITH CHECK error. Proven
-- by running that exact statement as `authenticated` with and without
-- RETURNING: without it succeeds, with it raises 42501.
--
-- Nobody noticed the table denies SELECT because the bucket is public, and
-- public reads are served from /object/public/ which never consults RLS.
--
-- Owner-scoped rather than bucket-wide: seeing your own row is all the upload
-- path needs.

create policy "avatar owner can read own row" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and name = (select current_entrant_id())::text);
