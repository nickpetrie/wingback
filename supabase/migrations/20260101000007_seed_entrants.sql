-- The fixed roster, unclaimed until each person signs in and picks their
-- own name. Stable ids so season_winners (seeded below, from the historical
-- Google Sheets trackers) can reference them directly.
--
-- One wrinkle: on a project where someone already signed in under the old
-- model (auto-create-on-signup, entrants.id == auth.users.id), that row
-- already exists and holds real data (their nomination, any picks). Relabel
-- it in place rather than seeding a second, duplicate row for the same
-- person — matched by email, since that's the one stable link back to who
-- they are.
do $$
declare
  v_nick_auth_id uuid;
  v_nick_id uuid;
  v_tom_id uuid := 'a1000000-0000-0000-0000-000000000002';
  v_alex_id uuid := 'a1000000-0000-0000-0000-000000000003';
  v_henry_id uuid := 'a1000000-0000-0000-0000-000000000004';
  v_casra_id uuid := 'a1000000-0000-0000-0000-000000000005';
begin
  select id into v_nick_auth_id from auth.users where email = 'nicholas.petrie@gmail.com';

  if v_nick_auth_id is not null and exists (select 1 from entrants where id = v_nick_auth_id) then
    update entrants set display_name = 'Nick Petrie', auth_user_id = v_nick_auth_id
    where id = v_nick_auth_id;
    v_nick_id := v_nick_auth_id;
  else
    v_nick_id := 'a1000000-0000-0000-0000-000000000001';
    insert into entrants (id, display_name) values (v_nick_id, 'Nick Petrie');
  end if;

  insert into entrants (id, display_name) values
    (v_tom_id, 'Tom Petrie'),
    (v_alex_id, 'Alex Beetles'),
    (v_henry_id, 'Henry Kirby'),
    (v_casra_id, 'Casra Abedian')
  on conflict (id) do nothing;

  -- From the "Wingback PL goal tracker" sheets, 2021/22 through 2025/26
  -- (2020/21 excluded: a sixth, non-roster participant and an erroring
  -- final-standings formula made it unreliable).
  insert into season_winners (season_label, entrant_id, points) values
    ('2021/22', v_casra_id, 25),
    ('2022/23', v_alex_id, 18),
    ('2023/24', v_nick_id, 18),
    ('2024/25', v_alex_id, 23),
    ('2025/26', v_casra_id, 19)
  on conflict (season_label, entrant_id) do nothing;
end $$;
