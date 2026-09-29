-- The avatar cropper emits a 512px JPEG at quality 0.85 — tens of kilobytes —
-- but the bucket accepted any type at any size from anyone who could sign in.
-- 1 MiB is an order of magnitude above what the app sends and an order of
-- magnitude below what a public bucket should hand out per request.
--
-- Needs Supabase's storage schema, so like 20260101000008 it is excluded from
-- the local pgTAP harness (see supabase/tests/run.sh).
update storage.buckets
set allowed_mime_types = '{image/jpeg}', file_size_limit = 1048576
where id = 'avatars';
