// One-way mirror of the live standings and full pick history into a
// Google Sheet the app owns, as a human-readable backup that lives
// outside Postgres. Deliberately a *separate* sheet, never the group's
// own manually-edited tracker: this only ever writes, on a schedule, so
// there's nothing to conflict with. Overwrites each named range from its
// top-left cell every run — simple and idempotent, at the cost of never
// shrinking a range that's already grown (picks only ever accumulate
// within a season, so that's not a real problem in practice).
import { serviceClient } from "../_shared/supabase.ts";
import { getGoogleAccessToken, writeSheetRange } from "../_shared/google.ts";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

Deno.serve(async () => {
  try {
    const clientEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const privateKeyRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
    const spreadsheetId = Deno.env.get("GOOGLE_SHEETS_BACKUP_ID");
    if (!clientEmail || !privateKeyRaw || !spreadsheetId) {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY / GOOGLE_SHEETS_BACKUP_ID are not set for this function",
      );
    }
    // The private key is stored with literal "\n" escapes (how it survives
    // being pasted as a single-line secret value) and needs real newlines
    // to parse as PEM.
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

    const supabase = serviceClient();
    const accessToken = await getGoogleAccessToken(clientEmail, privateKey, SHEETS_SCOPE);

    const { data: leaderboard, error: leaderboardError } = await supabase
      .from("leaderboard")
      .select("display_name, total_points, scoring_gameweeks");
    if (leaderboardError) throw leaderboardError;

    const leaderboardRows: (string | number)[][] = [
      ["Entrant", "Points", "Scoring gameweeks"],
      ...(leaderboard ?? []).map((r) => [r.display_name, r.total_points, r.scoring_gameweeks]),
    ];
    await writeSheetRange(accessToken, spreadsheetId, "Leaderboard!A1", leaderboardRows);

    const { data: picks, error: picksError } = await supabase
      .from("picks")
      // The FK hint is required: picks has two foreign keys into players, so
      // an unqualified embed is ambiguous and PostgREST refuses the query.
      .select(
        "gameweek, stake, goals, entrants(display_name), players!picks_player_code_fkey(web_name, teams(short_name))",
      )
      .order("gameweek", { ascending: true });
    if (picksError) throw picksError;

    const pickRows: (string | number)[][] = [
      ["Gameweek", "Entrant", "Player", "Team", "Stake", "Goals"],
      ...(picks ?? []).map((p) => [
        p.gameweek,
        p.entrants?.display_name ?? "",
        p.players?.web_name ?? "",
        p.players?.teams?.short_name ?? "",
        p.stake,
        p.goals,
      ]),
    ];
    await writeSheetRange(accessToken, spreadsheetId, "Picks!A1", pickRows);

    return Response.json({
      ok: true,
      leaderboardRows: leaderboardRows.length,
      pickRows: pickRows.length,
    });
  } catch (err) {
    console.error("sheets-backup failed", err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
});
