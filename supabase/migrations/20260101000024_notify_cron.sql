-- The dispatcher that takes notification rows out to email, SMS and push.
--
-- Every five minutes rather than every fifteen like remind: a goal alert that
-- lands a quarter of an hour after the goal is worse than no goal alert, and
-- the run does nothing at all when the table is empty, which is most of the
-- time. See 20260101000004_cron.sql for why call_edge_function reads its
-- credentials from Vault at call time rather than baking them in here.
select cron.schedule('wingback-notify', '*/5 * * * *', $$select call_edge_function('notify');$$);
