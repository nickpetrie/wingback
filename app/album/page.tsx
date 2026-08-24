import { createClient } from "@/lib/supabase/server";
import { getCurrentEntrantId } from "@/lib/entrant";

const TOTAL_GAMEWEEKS = 38;

type Slot =
  | { state: "empty"; gameweek: number }
  | {
      state: "pending" | "scored" | "blanked";
      gameweek: number;
      playerCode: number;
      webName: string;
      teamShortName: string;
      stake: 3 | 6;
      goals: number;
    };

export default async function AlbumPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const entrantId = await getCurrentEntrantId(supabase, user.id);
  if (!entrantId) return null; // middleware sends anyone without a claim to /claim first

  const { data: picks } = await supabase
    .from("picks")
    .select("gameweek, player_code, stake, goals, players(web_name, teams(short_name))")
    .eq("entrant_id", entrantId);

  const { data: gameweeks } = await supabase.from("gameweeks").select("id, finished");
  const finishedByGw = new Map((gameweeks ?? []).map((g) => [g.id, g.finished]));

  const byGameweek = new Map((picks ?? []).map((p) => [p.gameweek, p]));

  const slots: Slot[] = Array.from({ length: TOTAL_GAMEWEEKS }, (_, i) => {
    const gw = i + 1;
    const pick = byGameweek.get(gw);
    if (!pick || !pick.players) return { state: "empty", gameweek: gw };

    const finished = finishedByGw.get(gw) ?? false;
    const state = !finished ? "pending" : pick.goals > 0 ? "scored" : "blanked";

    return {
      state,
      gameweek: gw,
      playerCode: pick.player_code,
      webName: pick.players.web_name,
      teamShortName: pick.players.teams?.short_name ?? "",
      stake: pick.stake,
      goals: pick.goals,
    };
  });

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-extrabold text-foreground">Your album</h1>
      <p className="mt-1 text-sm text-foreground/50">38 gameweeks, one sticker each.</p>

      <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
        {slots.map((slot) => (
          <StickerSlot key={slot.gameweek} slot={slot} />
        ))}
      </div>
    </main>
  );
}

function StickerSlot({ slot }: { slot: Slot }) {
  if (slot.state === "empty") {
    return (
      <div className="flex aspect-[3/4] flex-col items-center justify-center rounded-xl border-2 border-dashed border-foreground/15 text-foreground/25">
        <span className="text-lg font-bold">{slot.gameweek}</span>
      </div>
    );
  }

  const badge =
    slot.state === "scored" ? (
      <span className="rounded-full bg-pitch-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
        +{slot.goals * (slot.stake === 6 ? 2 : 1)}
      </span>
    ) : slot.state === "blanked" ? (
      <span className="rounded-full bg-pitch-900/30 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
        blank
      </span>
    ) : (
      <span className="rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-bold text-pitch-900 shadow-sm">
        GW{slot.gameweek}
      </span>
    );

  return (
    <div
      className={`relative flex aspect-[3/4] flex-col overflow-hidden rounded-xl border-2 ${
        slot.state === "pending" ? "border-gold-400" : "border-transparent"
      } bg-white shadow-md transition-transform hover:-translate-y-0.5`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- posterised server-processed image, not eligible for next/image optimization */}
      <img
        src={`/api/player-image/${slot.playerCode}`}
        alt={slot.webName}
        className="h-3/4 w-full object-cover"
      />
      <div className="flex flex-1 flex-col items-center justify-center bg-pitch-50 px-1 text-center">
        <p className="truncate text-xs font-semibold text-pitch-900">{slot.webName}</p>
        <p className="text-[10px] text-pitch-900/40">{slot.teamShortName}</p>
      </div>
      <div className="absolute right-1 top-1">{badge}</div>
      {slot.stake === 6 && (
        <div className="absolute left-1 top-1 rounded-full bg-pitch-900 px-2 py-0.5 text-[10px] font-bold text-gold-400 shadow-sm">
          x2
        </div>
      )}
    </div>
  );
}
