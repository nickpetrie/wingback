-- Nick has two entrant rows: an orphan from before the profile-claiming
-- migrations ran (auth_user_id null, created under a mistyped email —
-- "nicholaspetrie@gmail.com" instead of "nicholas.petrie@gmail.com" — so
-- the seed migration's email match missed it and created a second, fresh
-- row instead), and the one he actually claimed and uses today. The
-- orphan holds his real gameweek-1 pick; move it, then remove the orphan.
--
-- An entrant_id-only change trips neither of picks_guard's conditions
-- (both keyed on player_code/stake changing), so this passes through
-- untouched — no need to disable the trigger.
do $$
declare
  v_wrong_nick uuid := '3c957a14-749c-4765-9b0f-99b4474b5a4e';
  v_real_nick uuid := 'a1000000-0000-0000-0000-000000000001';
begin
  update picks set entrant_id = v_real_nick where entrant_id = v_wrong_nick;
  update reminders_sent set entrant_id = v_real_nick where entrant_id = v_wrong_nick;
  delete from entrants where id = v_wrong_nick;
end $$;
