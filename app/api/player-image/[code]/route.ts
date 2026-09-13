import { createClient } from "@/lib/supabase/server";
import { renderPlayerCard } from "@/lib/playerCard";

// s-maxage is the one Vercel's edge network keys shared caching on, and it was
// missing — so every cold miss (a new device, another entrant, anything past a
// day) re-ran the whole route: a Supabase lookup, a fetch from the Premier
// League CDN, and two sharp passes. Expanding one leaderboard row asks for 38
// of these at once.
//
// A year is safe because these are keyed by players.code, which is stable
// across seasons (see CLAUDE.md) — the bytes for a given code never change.
const CACHE_CONTROL = "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: codeParam } = await params;
  const code = Number(codeParam);
  if (!Number.isInteger(code)) {
    return new Response("invalid player code", { status: 400 });
  }

  const supabase = await createClient();
  const { data: player } = await supabase
    .from("players")
    .select("web_name, photo, teams(short_name)")
    .eq("code", code)
    .maybeSingle();

  if (!player) {
    return new Response("not found", { status: 404 });
  }

  const card = await renderPlayerCard({
    code,
    webName: player.web_name,
    photo: player.photo,
    teamShortName: player.teams?.short_name ?? "",
  });

  return new Response(new Uint8Array(card), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
