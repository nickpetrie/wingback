import type { CurrentGameweek } from "@/lib/gameweek";
import { Countdown } from "./pick/Countdown";

export function GameweekStatusBar({ gameweek }: { gameweek: CurrentGameweek | null }) {
  if (!gameweek) return null;

  const content =
    gameweek.state === "open" ? (
      <>
        ⏱ Gameweek {gameweek.id} locks in{" "}
        <span className="font-semibold text-gold-400">
          <Countdown lockAt={gameweek.lock_at!} />
        </span>
      </>
    ) : gameweek.state === "locked" ? (
      <>🔒 Gameweek {gameweek.id} is live — no more picks until next gameweek</>
    ) : (
      <>📅 Gameweek {gameweek.id} isn&rsquo;t scheduled yet</>
    );

  return (
    <div className="bg-pitch-900/95 px-4 py-1.5 text-center text-xs font-medium text-white/90">
      {content}
    </div>
  );
}
