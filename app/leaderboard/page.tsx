import { createClient } from "@/lib/supabase/server";
import { getStarCounts } from "@/lib/winners";
import { teamColor } from "@/lib/teamColors";
import { LeaderboardTable, type BoardRow, type SeasonCell } from "./LeaderboardTable";

const TOTAL_GAMEWEEKS = 38;

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const { data: leaderboard } = await supabase
    .from("leaderboard")
    .select("entrant_id, display_name, total_points, scoring_gameweeks");

  const { data: avatars } = await supabase.from("entrants").select("id, avatar_updated_at");
  const avatarAt = new Map((avatars ?? []).map((a) => [a.id, a.avatar_updated_at]));
  const starCounts = await getStarCounts(supabase);

  const { data: gameweeks } = await supabase.from("gameweeks").select("id, finished");
  const finishedByGw = new Map((gameweeks ?? []).map((g) => [g.id, g.finished]));

  const { data: allPicks } = await supabase
    .from("picks")
    // The FK hint is load-bearing — see lib/picks.ts. Without it this query
    // returns nothing and every season record renders as 38 empty gameweeks.
    .select(
      "entrant_id, gameweek, player_code, stake, goals, players!picks_player_code_fkey(web_name, teams(short_name))",
    );

  const rows: BoardRow[] = (leaderboard ?? [])
    .slice()
    .sort((a, b) => b.total_points - a.total_points || b.scoring_gameweeks - a.scoring_gameweeks)
    .map((entrant, i, sorted) => {
      const mine = (allPicks ?? []).filter((p) => p.entrant_id === entrant.entrant_id);
      const byGw = new Map(mine.map((p) => [p.gameweek, p]));

      const album: SeasonCell[] = Array.from({ length: TOTAL_GAMEWEEKS }, (_, gwIndex) => {
        const gw = gwIndex + 1;
        const pick = byGw.get(gw);
        if (!pick || !pick.players) return { state: "empty", gw };

        const finished = finishedByGw.get(gw) ?? false;
        if (!finished) return { state: "pending", gw, playerCode: pick.player_code, webName: pick.players.web_name };

        const hat = pick.goals >= 3;
        return {
          state: pick.goals > 0 ? "scored" : "blanked",
          gw,
          playerCode: pick.player_code,
          webName: pick.players.web_name,
          teamColor: teamColor(pick.players.teams?.short_name ?? ""),
          goals: pick.goals,
          stake: pick.stake,
          hat,
        };
      });

      // Trailing streak of finished, scoreless gameweeks — the one bit of
      // "banter" copy that's actually derived from real data rather than
      // invented, per the design chat's confirmed banter:true setting.
      let blankStreak = 0;
      for (let gw = TOTAL_GAMEWEEKS; gw >= 1; gw--) {
        if (!(finishedByGw.get(gw) ?? false)) continue;
        const pick = byGw.get(gw);
        if (!pick) break;
        if (pick.goals > 0) break;
        blankStreak++;
      }
      const note =
        blankStreak >= 2
          ? `${blankStreak} blanks running`
          : i === 0
            ? "top of the pile"
            : i === sorted.length - 1
              ? "battling the wooden spoon"
              : "";

      const stars = starCounts.get(entrant.entrant_id) ?? 0;
      const totalPicks = mine.length;

      return {
        entrant_id: entrant.entrant_id,
        avatar_updated_at: avatarAt.get(entrant.entrant_id) ?? null,
        rank: i + 1,
        name: entrant.display_name,
        stars,
        note,
        points: entrant.total_points,
        scoring: entrant.scoring_gameweeks,
        album,
        summary: `${entrant.scoring_gameweeks} scoring gameweeks from ${totalPicks} pick${totalPicks === 1 ? "" : "s"}. ${
          stars > 0 ? `${stars} title${stars > 1 ? "s" : ""} on the shirt.` : "Still waiting on a first title."
        }`,
      };
    });

  return (
    <main className="wb-in wb-page" style={{ padding: "32px 24px 64px" }}>
      <div style={{ borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>The table</h1>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
          Tap a name for their season record
        </p>
      </div>

      <LeaderboardTable rows={rows} />

      <p style={{ margin: "14px 0 0", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
        Ties break on the most individual gameweeks with a scoring pick. Points are never stored — they&rsquo;re
        derived from goals every time you load this.
      </p>
    </main>
  );
}
