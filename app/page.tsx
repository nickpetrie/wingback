import { createClient } from "@/lib/supabase/server";
import { getCurrentGameweek } from "@/lib/gameweek";
import { getCurrentEntrantId } from "@/lib/entrant";
import { getGameweekFixtures, kickoffLabel, type GameweekFixture } from "@/lib/fixtures";
import { getGameweekPicks } from "@/lib/picks";
import { getPickFormContext } from "@/lib/pick-form-context";
import { relativeTime } from "@/lib/relativeTime";
import { computeUsedCounts, doublesUsed, type PickHistoryEntry } from "@/lib/rules";
import { FixtureDayList } from "./FixtureDayList";
import { STATUS_LABEL } from "./PlayerSearchInput";
import { TeamBadge } from "./TeamBadge";
import { PickForm } from "./pick/PickForm";

function fixtureFor(fixtures: GameweekFixture[], teamId: number) {
  const f = fixtures.find((fx) => fx.team_h === teamId || fx.team_a === teamId);
  if (!f) return null;
  return { match: `${f.home} v ${f.away}`, when: kickoffLabel(f.kickoff_time) };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const entrantId = await getCurrentEntrantId(supabase, user.id);
  if (!entrantId) return null; // middleware sends anyone without a claim to /claim first

  const gameweek = await getCurrentGameweek(supabase);
  const fixtures = gameweek ? await getGameweekFixtures(supabase, gameweek.id) : [];
  const picks = gameweek ? await getGameweekPicks(supabase, gameweek.id) : [];
  const myPick = picks.find((p) => p.entrant_id === entrantId) ?? null;
  const pickForm =
    gameweek?.state === "open" ? await getPickFormContext(supabase, entrantId, gameweek.id) : null;

  const { data: otherEntrants } = await supabase
    .from("entrants")
    .select("id, display_name")
    .neq("id", entrantId)
    .order("created_at", { ascending: true });
  const others = (otherEntrants ?? []).map((e) => ({
    entrant: e.display_name.split(" ")[0],
    pick: picks.find((p) => p.entrant_id === e.id) ?? null,
  }));

  const { data: entrantRow } = await supabase
    .from("entrants")
    .select("nomination_player_code")
    .eq("id", entrantId)
    .single();
  const nominationCode = entrantRow?.nomination_player_code ?? null;

  const { data: historyRaw } = await supabase
    .from("picks")
    .select("gameweek, player_code, goals, stake")
    .eq("entrant_id", entrantId);
  const history: PickHistoryEntry[] = historyRaw ?? [];
  const usedCounts = computeUsedCounts(history);
  const doublesLeft = Math.max(0, 2 - doublesUsed(history));
  const burnedCount = [...usedCounts.entries()].filter(
    ([code, count]) => count >= (code === nominationCode ? 2 : 1),
  ).length;

  let nominationName = "None yet";
  if (nominationCode) {
    const { data: nomPlayer } = await supabase
      .from("players")
      .select("web_name")
      .eq("code", nominationCode)
      .maybeSingle();
    nominationName = nomPlayer?.web_name ?? "None yet";
  }

  const { data: syncRow } = await supabase
    .from("sync_state")
    .select("synced_at")
    .eq("source", "players")
    .maybeSingle();
  const newsSyncedAt = syncRow?.synced_at ?? null;

  const playingTeamIds = new Set(fixtures.flatMap((f) => [f.team_h, f.team_a]));
  const { data: newsRaw } = await supabase
    .from("players")
    .select("code, web_name, status, news, team_id, teams(short_name)")
    .neq("news", "")
    .order("web_name");
  const news = (newsRaw ?? [])
    .map((p) => ({
      code: p.code,
      web_name: p.web_name,
      status: p.status,
      news: p.news,
      team_short_name: p.teams?.short_name ?? "",
      playingThisWeek: playingTeamIds.has(p.team_id),
    }))
    .sort((a, b) => Number(b.playingThisWeek) - Number(a.playingThisWeek))
    .slice(0, 6);

  const pickedCount = others.filter((o) => o.pick).length;
  const homeLine = myPick
    ? pickedCount === others.length
      ? `All five picks are in for gameweek ${gameweek?.id ?? "—"}.`
      : `${pickedCount} of the other four have picked so far.`
    : `${pickedCount} of the other four have already picked. Don't be last.`;

  const myFixture = myPick ? fixtureFor(fixtures, myPick.team_id) : null;
  const myPoints = myPick ? myPick.goals * (myPick.stake === 6 ? 2 : 1) : 0;

  return (
    <main className="wb-in" style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 24px 64px" }}>
      {/* The countdown lives in the sticky header on every page — repeating it
          here just cost a screenful of phone. */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          borderBottom: "2px solid var(--color-divider)",
          paddingBottom: 8,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22 }}>
          {gameweek ? `Gameweek ${gameweek.id}` : "Current gameweek"}
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
          {gameweek ? homeLine : "No gameweek data yet — check back once the season data has synced."}
        </p>
      </div>

      {gameweek && (
        <>
          <div className="wb-home-split">
            <section className="wb-home-split-left">
              <h6 style={{ margin: "0 0 12px" }}>Your pick</h6>
              {gameweek.state === "open" && pickForm ? (
                <PickForm
                  gameweek={gameweek.id}
                  players={pickForm.players}
                  fixtures={fixtures}
                  usedCounts={pickForm.usedCounts}
                  nominationCode={pickForm.nominationCode}
                  doublesUsedCount={pickForm.doublesUsedCount}
                  currentPick={pickForm.currentPick}
                />
              ) : myPick ? (
                <div style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
                  <div style={{ position: "relative", width: 132, height: 172, flex: "none" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- server-posterised card, not eligible for next/image */}
                    <img
                      src={`/api/player-image/${myPick.player_code}`}
                      alt={myPick.player_name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        bottom: 0,
                        background: "rgba(0,0,0,.35)",
                        color: "#fff",
                        fontSize: 9,
                        letterSpacing: ".1em",
                        textTransform: "uppercase",
                        padding: "3px 6px",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <TeamBadge code={myPick.team_code} size={12} />
                      {myPick.team_short_name}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 44, lineHeight: 1.02, letterSpacing: "-.03em" }}>
                      {myPick.player_name}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                      {myFixture && (
                        <>
                          <span className="tag tag-neutral">{myFixture.match}</span>
                          <span className="tag tag-neutral">{myFixture.when}</span>
                        </>
                      )}
                      <span
                        style={
                          myPick.stake === 6
                            ? { display: "inline-flex", alignItems: "center", fontSize: 11, padding: "3px 10px", background: "var(--color-accent)", color: "var(--color-bg)" }
                            : { display: "inline-flex", alignItems: "center", fontSize: 11, padding: "3px 10px", background: "var(--color-neutral-200)", color: "var(--color-neutral-800)" }
                        }
                      >
                        {myPick.stake === 6 ? "£6 · doubled" : "£3"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 24, marginTop: "auto", paddingTop: 20 }}>
                      <div>
                        <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 56, lineHeight: 0.9, fontVariantNumeric: "tabular-nums" }}>
                          {myPick.goals}
                        </p>
                        <p style={{ margin: 0, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                          goals
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 56, lineHeight: 0.9, fontVariantNumeric: "tabular-nums", color: "var(--color-accent)" }}>
                          {myPoints}
                        </p>
                        <p style={{ margin: 0, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                          points
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ border: "2px dashed var(--color-divider)", padding: "32px 24px" }}>
                  <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 26, lineHeight: 1.1 }}>
                    You didn&rsquo;t pick this gameweek.
                  </p>
                </div>
              )}
            </section>

            <section className="wb-home-split-right">
              <h6 style={{ margin: "0 0 12px" }}>The other four</h6>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--color-divider)" }}>
                {others.map((o) => (
                  <div key={o.entrant} style={{ background: "var(--color-bg)", padding: 12, display: "flex", gap: 10, alignItems: "flex-start", minHeight: 96 }}>
                    {o.pick ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element -- server-posterised card */}
                        <img
                          src={`/api/player-image/${o.pick.player_code}`}
                          alt={o.pick.player_name}
                          style={{ width: 44, height: 44, flex: "none", objectFit: "cover" }}
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
                            {o.entrant}
                          </p>
                          <p style={{ margin: "1px 0 0", fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 17, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {o.pick.player_name}
                          </p>
                          <p style={{ margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                            <TeamBadge code={o.pick.team_code} size={12} />
                            {o.pick.team_short_name}
                            {o.pick.stake === 6 ? " · ×2" : ""}
                          </p>
                        </div>
                        {(() => {
                          const pts = o.pick.goals * (o.pick.stake === 6 ? 2 : 1);
                          return (
                            <span
                              style={{
                                fontFamily: "var(--font-heading)",
                                fontWeight: 800,
                                fontSize: 24,
                                lineHeight: 1,
                                fontVariantNumeric: "tabular-nums",
                                color: pts > 0 ? "var(--color-accent)" : "color-mix(in srgb, var(--color-text) 30%, transparent)",
                              }}
                            >
                              {pts > 0 ? `+${pts}` : "0"}
                            </span>
                          );
                        })()}
                      </>
                    ) : (
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
                          {o.entrant}
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>No Pick Made</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <details className="wb-fixtures" open>
            <summary className="wb-fixtures-head">
              <span className="wb-chev" aria-hidden="true">
                ▶
              </span>
              <h6 style={{ margin: 0 }}>Gameweek {gameweek.id} fixtures</h6>
              <span className="wb-fixtures-note">Picks are public the moment they&rsquo;re made</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
                {fixtures.length > 0 ? `${fixtures.length} matches` : "none yet"}
              </span>
            </summary>
            {fixtures.length === 0 ? (
              <p style={{ margin: "12px 0 0", fontSize: 13, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                No fixtures confirmed yet.
              </p>
            ) : (
              <FixtureDayList fixtures={fixtures} picks={picks} />
            )}
          </details>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "var(--color-divider)", border: "1px solid var(--color-divider)" }}>
            <div style={{ background: "var(--color-surface)", padding: "16px 18px" }}>
              <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 32, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {doublesLeft}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                Free doubles left
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                After that, a blank ×2 costs you −2.
              </p>
            </div>
            <div style={{ background: "var(--color-surface)", padding: "16px 18px" }}>
              <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 32, lineHeight: 1 }}>{nominationName}</p>
              <p style={{ margin: "4px 0 0", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                Your nomination
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                The one player you&rsquo;re allowed twice.
              </p>
            </div>
            <div style={{ background: "var(--color-surface)", padding: "16px 18px" }}>
              <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 32, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {burnedCount}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                Players burned
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                A hat-trick puts one back on the board.
              </p>
            </div>
          </section>

          <section style={{ padding: "24px 0" }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                borderBottom: "2px solid var(--color-divider)",
                paddingBottom: 8,
              }}
            >
              <h6 style={{ margin: 0 }}>Injury news</h6>
              {newsSyncedAt && (
                <span
                  title={new Date(newsSyncedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}
                  style={{ fontSize: 11, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}
                >
                  Synced {relativeTime(newsSyncedAt)}
                </span>
              )}
            </div>
            {news.length === 0 ? (
              <p style={{ margin: "12px 0 0", fontSize: 13, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                No injury news at the moment.
              </p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 1, background: "var(--color-divider)", marginTop: 12 }}>
                {news.map((p) => (
                  <div key={p.code} style={{ background: "var(--color-bg)", padding: "10px 12px" }}>
                    <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 14 }}>
                      {p.web_name} <span style={{ fontWeight: 400, fontSize: 11, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>{p.team_short_name}</span>
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-accent-700)" }}>
                      {STATUS_LABEL[p.status] ?? p.status}: {p.news}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
