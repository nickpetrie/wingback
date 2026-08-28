// Hourly (and, near a deadline, every 10 minutes): pulls squads, injuries,
// and fixtures from FPL and mirrors them into Postgres. lock_at is not
// touched here directly — it's recomputed by the fixtures_recompute_lock
// trigger the moment a fixture's kickoff_time changes.
import { serviceClient } from "../_shared/supabase.ts";
import { fetchAllFixtures, fetchBootstrap, startFplBudget } from "../_shared/fpl.ts";

Deno.serve(async () => {
  try {
    startFplBudget();
    const supabase = serviceClient();
    // Sequential, not Promise.all, for the same reason as score/: a rejected
    // Promise.all abandons the other request mid-retry and leaves its eventual
    // rejection unhandled.
    const bootstrap = await fetchBootstrap();

    const { error: teamsError } = await supabase
      .from("teams")
      .upsert(
        bootstrap.teams.map((t) => ({
          id: t.id,
          code: t.code,
          name: t.name,
          short_name: t.short_name,
        })),
      );
    if (teamsError) throw teamsError;

    const { error: gwError } = await supabase.from("gameweeks").upsert(
      bootstrap.events.map((e) => ({
        id: e.id,
        deadline_time: e.deadline_time,
        finished: e.finished,
      })),
    );
    if (gwError) throw gwError;

    // Snapshot current status before overwriting, so we can tell what changed.
    const { data: existingPlayers, error: existingError } = await supabase
      .from("players")
      .select("code, status, news, chance_of_playing_next_round");
    if (existingError) throw existingError;
    const previous = new Map(
      (existingPlayers ?? []).map((p) => [p.code, p]),
    );

    const historyRows = bootstrap.elements
      .filter((el) => {
        const prev = previous.get(el.code);
        if (!prev) return false; // first sync ever for this player: no "change" to log
        return (
          prev.status !== el.status ||
          prev.news !== el.news ||
          prev.chance_of_playing_next_round !== el.chance_of_playing_next_round
        );
      })
      .map((el) => ({
        player_code: el.code,
        status: el.status,
        news: el.news,
        chance_of_playing_next_round: el.chance_of_playing_next_round,
      }));

    if (historyRows.length > 0) {
      const { error: historyError } = await supabase
        .from("player_status_history")
        .insert(historyRows);
      if (historyError) throw historyError;
    }

    const { error: playersError } = await supabase.from("players").upsert(
      bootstrap.elements.map((el) => ({
        code: el.code,
        fpl_id: el.id,
        web_name: el.web_name,
        first_name: el.first_name,
        second_name: el.second_name,
        team_id: el.team,
        element_type: el.element_type,
        status: el.status,
        news: el.news,
        chance_of_playing_next_round: el.chance_of_playing_next_round,
        photo: el.photo,
        goals_scored: el.goals_scored,
        assists: el.assists,
        starts: el.starts,
        minutes: el.minutes,
      })),
      { onConflict: "code" },
    );
    if (playersError) throw playersError;

    // Fetched after the bootstrap writes, and allowed to fail on its own: FPL
    // refusing this one call used to discard a successful 5MB bootstrap along
    // with it, leaving squads and injury news an hour stale for no reason.
    // Teams must already be in place before this runs (fixtures FK them).
    let fixtureCount: number | null = null;
    let fixturesFailed: string | null = null;
    try {
      const fixtures = await fetchAllFixtures();
      // Fixtures without a kickoff yet still need an `event` so a gameweek's
      // fixture *count* is right; a null kickoff just won't move lock_at.
      const { error: fixturesError } = await supabase.from("fixtures").upsert(
        fixtures.map((f) => ({
          id: f.id,
          event: f.event,
          team_h: f.team_h,
          team_a: f.team_a,
          kickoff_time: f.kickoff_time,
          finished: f.finished,
          finished_provisional: f.finished_provisional,
          started: f.started,
          minutes: f.minutes,
        })),
      );
      if (fixturesError) throw fixturesError;
      fixtureCount = fixtures.length;
    } catch (err) {
      fixturesFailed = err instanceof Error ? err.message : String(err);
      console.error("sync-fpl: fixtures leg failed, bootstrap leg kept", err);
    }

    return Response.json({
      ok: fixturesFailed === null,
      teams: bootstrap.teams.length,
      players: bootstrap.elements.length,
      gameweeks: bootstrap.events.length,
      fixtures: fixtureCount,
      fixturesFailed,
      statusChanges: historyRows.length,
    });
  } catch (err) {
    console.error("sync-fpl failed", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
