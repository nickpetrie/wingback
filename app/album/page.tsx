import { createClient } from "@/lib/supabase/server";

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

  const { data: picks } = await supabase
    .from("picks")
    .select("gameweek, player_code, stake, goals, players(web_name, teams(short_name))")
    .eq("entrant_id", user.id);

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
      <h1 className="text-xl font-bold">Your album</h1>
      <p className="mt-1 text-sm text-neutral-500">38 gameweeks, one sticker each.</p>

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
      <div className="flex aspect-[3/4] flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 text-neutral-300">
        <span className="text-lg font-bold">{slot.gameweek}</span>
      </div>
    );
  }

  const badge =
    slot.state === "scored" ? (
      <span className="rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
        +{slot.goals * (slot.stake === 6 ? 2 : 1)}
      </span>
    ) : slot.state === "blanked" ? (
      <span className="rounded bg-neutral-400 px-1.5 py-0.5 text-[10px] font-bold text-white">blank</span>
    ) : (
      <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-white">GW{slot.gameweek}</span>
    );

  return (
    <div
      className={`relative flex aspect-[3/4] flex-col overflow-hidden rounded-lg border ${
        slot.state === "pending" ? "border-amber-300" : "border-neutral-200"
      } bg-white shadow-sm`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- posterised server-processed image, not eligible for next/image optimization */}
      <img
        src={`/api/player-image/${slot.playerCode}`}
        alt={slot.webName}
        className="h-3/4 w-full object-cover"
      />
      <div className="flex flex-1 flex-col items-center justify-center px-1 text-center">
        <p className="truncate text-xs font-semibold">{slot.webName}</p>
        <p className="text-[10px] text-neutral-400">{slot.teamShortName}</p>
      </div>
      <div className="absolute right-1 top-1">{badge}</div>
      {slot.stake === 6 && (
        <div className="absolute left-1 top-1 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          x2
        </div>
      )}
    </div>
  );
}
