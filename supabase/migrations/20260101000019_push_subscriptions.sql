-- Web push subscriptions. One row per browser, not per entrant: the same
-- person can have the app installed on a phone and a laptop, and each has its
-- own endpoint and its own keys.
--
-- The endpoint is the natural key — the push service hands back the same URL
-- for the same browser, so re-subscribing updates rather than accumulating
-- duplicates that would each deliver a copy of every notification.
create table push_subscriptions (
  endpoint text primary key,
  entrant_id uuid not null references entrants(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_entrant_idx on push_subscriptions (entrant_id);

alter table push_subscriptions enable row level security;

-- Same shape as every other write rule here: you may only touch your own row,
-- and current_entrant_id() is what "yours" means.
create policy "own push subscriptions readable" on push_subscriptions
  for select to authenticated using (entrant_id = (select current_entrant_id()));

create policy "own push subscriptions insertable" on push_subscriptions
  for insert to authenticated with check (entrant_id = (select current_entrant_id()));

create policy "own push subscriptions updatable" on push_subscriptions
  for update to authenticated
  using (entrant_id = (select current_entrant_id()))
  with check (entrant_id = (select current_entrant_id()));

create policy "own push subscriptions deletable" on push_subscriptions
  for delete to authenticated using (entrant_id = (select current_entrant_id()));

-- 'push' joins 'email' and 'sms' as a reminder channel, so reminders_sent can
-- keep doing the idempotency work for it too.
alter table reminders_sent drop constraint if exists reminders_sent_channel_check;
alter table reminders_sent add constraint reminders_sent_channel_check
  check (channel in ('email', 'sms', 'push'));
