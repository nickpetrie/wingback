import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentGameweek } from "@/lib/gameweek";
import { signOut } from "./actions";
import { LeaderboardStrip } from "./LeaderboardStrip";
import { GameweekStatusBar } from "./GameweekStatusBar";

const LINKS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/pick", label: "Pick", icon: "⚽" },
  { href: "/album", label: "Album", icon: "🗂️" },
  { href: "/leaderboard", label: "Leaderboard", icon: "🏆" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: leaderboard } = await supabase
    .from("leaderboard")
    .select("entrant_id, display_name, total_points, scoring_gameweeks");

  const gameweek = await getCurrentGameweek(supabase);

  return (
    <header className="sticky top-0 z-10">
      <GameweekStatusBar gameweek={gameweek} />
      <div className="bg-gradient-to-r from-pitch-900 via-pitch-800 to-pitch-700 px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-1 overflow-x-auto">
            <Link href="/" className="mr-2 shrink-0 text-lg font-extrabold tracking-tight text-gold-400">
              Wingback
            </Link>
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white"
              >
                <span aria-hidden>{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>
          <form action={signOut} className="shrink-0">
            <button type="submit" className="text-sm text-white/60 hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </div>
      <LeaderboardStrip rows={leaderboard ?? []} />
    </header>
  );
}
