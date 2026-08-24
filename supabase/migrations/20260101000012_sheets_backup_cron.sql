-- Mirrors standings + picks into a Google Sheet backup once an hour,
-- offset from the :00 sync-fpl job so they don't contend. Uses the same
-- call_edge_function() as every other scheduled job (20260101000004_cron.sql);
-- if the sheets-backup function's own Google secrets aren't set, it fails
-- inside the function and logs there — the Vault-secrets silent-no-op
-- failure mode that helper guards against doesn't apply to this one.
select cron.schedule('wingback-sheets-backup', '15 * * * *', $$select call_edge_function('sheets-backup');$$);
