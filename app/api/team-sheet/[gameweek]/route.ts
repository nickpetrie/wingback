import { createClient } from "@/lib/supabase/server";
import { getGameweekPicks } from "@/lib/picks";
import { renderPlayerCard } from "@/lib/playerCard";
import { renderTeamSheet, type TeamSheetEntry } from "@/lib/teamSheet";

export const runtime = "nodejs";

// A locked gameweek's team sheet can never change again — picks_guard
// refuses any further write to that gameweek's rows (see CLAUDE.md) — so
// this is exactly as safe to cache forever as a per-player card.
const CACHE_CONTROL = "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameweek: string }> },
) {
  const { gameweek: gwParam } = await params;
  const gameweekId = Number(gwParam);
  if (!Number.isInteger(gameweekId) || gameweekId < 1) {
    return new Response("invalid gameweek", { status: 400 });
  }

  const supabase = await createClient();

  const { data: gameweek } = await supabase
    .from("gameweeks")
    .select("lock_at")
    .eq("id", gameweekId)
    .maybeSingle();

  // Before lock, picks are still changing hands — a team sheet is a
  // snapshot, and there's nothing fixed yet to take one of. Picks being
  // visible pre-lock (CLAUDE.md) is a different question from whether this
  // particular gameweek is done.
  if (!gameweek?.lock_at || new Date(gameweek.lock_at) > new Date()) {
    return new Response("gameweek not locked yet", { status: 404 });
  }

  const picks = await getGameweekPicks(supabase, gameweekId);
  if (picks.length === 0) {
    return new Response("no picks for this gameweek", { status: 404 });
  }

  // getGameweekPicks doesn't promise an order, and this image is meant to
  // look the same on every request for the same (locked, so immutable)
  // gameweek — alphabetical by entrant is an arbitrary choice, but a stable
  // one.
  const sorted = [...picks].sort((a, b) => a.entrant_name.localeCompare(b.entrant_name));

  const { data: playersRaw } = await supabase
    .from("players")
    .select("code, photo, element_type")
    .in(
      "code",
      sorted.map((p) => p.player_code),
    );
  const playerInfoByCode = new Map(
    (playersRaw ?? []).map((p) => [p.code, { photo: p.photo, elementType: p.element_type }]),
  );

  const entries: TeamSheetEntry[] = await Promise.all(
    sorted.map(async (pick) => {
      const info = playerInfoByCode.get(pick.player_code);
      return {
        entrantName: pick.entrant_name,
        playerName: pick.player_name,
        teamShortName: pick.team_short_name,
        stake: pick.stake,
        // Falls back to midfielder (the most common pick) rather than
        // crashing the render on the rare row where the join misses —
        // wrong shirt-position on the pitch is a far smaller problem than a
        // 500 where a team sheet used to be.
        elementType: info?.elementType ?? 3,
        cardBuffer: await renderPlayerCard({
          code: pick.player_code,
          webName: pick.player_name,
          photo: info?.photo ?? null,
          teamShortName: pick.team_short_name,
        }),
      };
    }),
  );

  const png = await renderTeamSheet(gameweekId, entries);

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
