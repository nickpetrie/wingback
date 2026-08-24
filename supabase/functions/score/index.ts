// Every 10 minutes while a gameweek is live, and once daily for post-match
// corrections. Pulls goals from FPL and writes them onto picks.
//
// Two FPL sources, deliberately both used:
//   - /event/{gw}/live/ gives the per-gameweek TOTAL (already summed across
//     a double gameweek's two fixtures) -> written to picks.goals.
//   - /fixtures/?event={gw} gives per-FIXTURE goals -> written to
//     fixture_goals, which is what the double-gameweek penalty in the
//     pick_scores view needs (a per-gameweek total can't tell you which of
//     two fixtures was the goalless one).
import { serviceClient } from "../_shared/supabase.ts";
import { fetchFixturesForEvent, fetchLive, startFplBudget } from "../_shared/fpl.ts";

type ServiceClient = ReturnType<typeof serviceClient>;

Deno.serve(async (req) => {
  try {
    startFplBudget();
    const supabase = serviceClient();
    // The daily settle run also re-checks recently-finished gameweeks, in
    // case FPL corrects a goal after the match (own goal reassigned, VAR).
    // The frequent live-tick run only needs gameweeks still in progress.
    const settle = new URL(req.url).searchParams.get("settle") === "true";

    let query = supabase
      .from("gameweeks")
      .select("id, lock_at, finished")
      .not("lock_at", "is", null)
      .lte("lock_at", new Date().toISOString());
    query = settle
      ? query.gte("lock_at", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
      : query.eq("finished", false);

    const { data: liveGameweeks, error: gwError } = await query;
    if (gwError) throw gwError;

    const results: Record<number, unknown> = {};
    const failures: Record<number, string> = {};

    for (const gw of liveGameweeks ?? []) {
      try {
        results[gw.id] = await syncGameweek(supabase, gw.id);
      } catch (err) {
        // FPL refusing one gameweek shouldn't cost the others their update:
        // this used to abort the whole loop, and the settle run walks three
        // days of gameweeks at once. The next tick retries this one anyway.
        failures[gw.id] = err instanceof Error ? err.message : String(err);
        console.error(`score failed for gameweek ${gw.id}`, err);
      }
    }

    const failed = Object.keys(failures).length;
    return Response.json(
      { ok: failed === 0, gameweeks: results, failures },
      // Only a run that salvaged nothing is a failed run.
      { status: failed > 0 && Object.keys(results).length === 0 ? 500 : 200 },
    );
  } catch (err) {
    console.error("score failed", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});

async function syncGameweek(supabase: ServiceClient, gwId: number) {
  // Sequential, not Promise.all: Promise.all rejects the moment the first
  // request gives up, while the second is still working through its retries,
  // so its later rejection has nobody left to catch it.
  const fixtures = await fetchFixturesForEvent(gwId);
  const live = await fetchLive(gwId);

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("code, fpl_id");
  if (playersError) throw playersError;

  const codeByFplId: Record<number, number> = {};
  const fplIdByCode: Record<number, number> = {};
  for (const p of players as { code: number; fpl_id: number }[]) {
    codeByFplId[p.fpl_id] = p.code;
    fplIdByCode[p.code] = p.fpl_id;
  }

  // Per-fixture goals, from the fixtures endpoint's own stats block.
  const fixtureGoalRows: { fixture_id: number; player_code: number; goals: number }[] = [];
  for (const fixture of fixtures) {
    const goalsStat = fixture.stats?.find((s) => s.identifier === "goals_scored");
    if (!goalsStat) continue;
    for (const entry of [...goalsStat.h, ...goalsStat.a]) {
      const code = codeByFplId[entry.element];
      if (code === undefined) continue;
      fixtureGoalRows.push({ fixture_id: fixture.id, player_code: code, goals: entry.value });
    }
  }
  if (fixtureGoalRows.length > 0) {
    const { error } = await supabase.from("fixture_goals").upsert(fixtureGoalRows);
    if (error) throw error;
  }

  const { error: fixturesError } = await supabase.from("fixtures").upsert(
    fixtures.map((f) => ({
      id: f.id,
      event: f.event,
      team_h: f.team_h,
      team_a: f.team_a,
      kickoff_time: f.kickoff_time,
      finished: f.finished,
    })),
  );
  if (fixturesError) throw fixturesError;

  // Per-gameweek totals (correct even across a double gameweek).
  const { data: picks, error: picksError } = await supabase
    .from("picks")
    .select("id, player_code")
    .eq("gameweek", gwId);
  if (picksError) throw picksError;

  const totalByFplId: Record<number, number> = {};
  for (const el of live.elements) {
    totalByFplId[el.id] = el.stats.goals_scored;
  }

  for (const pick of picks ?? []) {
    const fplId = fplIdByCode[pick.player_code];
    const goals = fplId !== undefined ? totalByFplId[fplId] ?? 0 : 0;
    const { error } = await supabase.from("picks").update({ goals }).eq("id", pick.id);
    if (error) throw error;
  }

  const allFinished = fixtures.length > 0 && fixtures.every((f) => f.finished);
  if (allFinished) {
    const { error } = await supabase.from("gameweeks").update({ finished: true }).eq("id", gwId);
    if (error) throw error;
  }

  return { fixtures: fixtures.length, picksUpdated: (picks ?? []).length, finished: allFinished };
}
