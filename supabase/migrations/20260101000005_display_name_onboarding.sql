-- Tracks whether an entrant has ever actually chosen their display name,
-- as opposed to still carrying the auto-generated email-prefix default
-- from handle_new_user(). Drives the first-login redirect to /settings in
-- proxy.ts — without this we'd have no reliable way to tell "chose their
-- name" apart from "name happens to equal the default" (someone whose
-- preferred name IS their email's local part would otherwise get stuck
-- being redirected to /settings forever).
alter table entrants add column display_name_set boolean not null default false;
