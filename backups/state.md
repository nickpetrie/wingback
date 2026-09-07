# Wingback — season state

Generated Mon 7 Sep 2026, 11:45 UTC by `scripts/backup.mjs`, on the same daily run that writes the snapshot beside it.

Read this first: it is the whole season in one file, so a session can answer questions about who picked what without a database connection. `wingback.json` is the restorable copy; this is the readable one, and it is regenerated from scratch every day rather than edited. Absolute times are the truth — anything phrased as *in 5d* or *45m ago* was measured at the moment above and is that much staler now.

## Right now

**Gameweek 4** is the one in play — open for picks.

- Deadline: Sat 12 Sep 2026, 12:30 UTC (in 5d)
- Picks lock: Sat 12 Sep 2026, 13:00 UTC (in 5d)
- Picked: 0 of 5
- Still to pick: Alex Beetles, Casra Abedian, Henry Kirby, Nick Petrie, Tom Petrie

## Standings (after gameweek 3)

| # | entrant | points | scoring GWs |
| --- | --- | --- | --- |
| 1 | Nick Petrie | 4 | 3 |
| 2 | Henry Kirby | 4 | 2 |
| 3 | Casra Abedian | 3 | 2 |
| 4 | Tom Petrie | 2 | 1 |
| 5 | Alex Beetles | 2 | 1 |

## Nominations, and who is spent

Each entrant nominates one player they may pick **twice** in the season; every other player is once only, and a hat-trick puts a player back to zero. Nominations lock once gameweek 2 has settled.

**A nomination is not a pick.** The nomination is the one player an entrant may use twice; it says nothing about who they have actually picked. The last column is what constrains them now: those players cannot be picked again this season.

| entrant | nomination | club | nomination used | players spent |
| --- | --- | --- | --- | --- |
| Alex Beetles | Haaland | MCI | 1/2 (GW 3) | Cunha, Gyökeres |
| Casra Abedian | Haaland | MCI | 1/2 (GW 3) | Mbeumo |
| Henry Kirby | Haaland | MCI | 2/2 (GW 2, 3) | Haaland |
| Nick Petrie | Haaland | MCI | 1/2 (GW 3) | Havertz, Isak |
| Tom Petrie | João Pedro | CHE | 0/2 | Haaland, Havertz |

## Every pick so far

| GW | Alex Beetles | Casra Abedian | Henry Kirby | Nick Petrie | Tom Petrie |
| --- | --- | --- | --- | --- | --- |
| 1 | Gyökeres | — | — | Havertz — 1pt | — |
| 2 | Cunha | Mbeumo — 1pt | Haaland — 2pt | Isak — 1pt | Havertz |
| 3 | Haaland ×2 — 2pt | Haaland ×2 — 2pt | Haaland ×2 — 2pt | Haaland ×2 — 2pt | Haaland ×2 — 2pt |

`×2` is a £6 stake (double points). Per-pick goals and clubs are in `picks.csv`.

## Who an alert actually reaches

The in-app feed always gets everything. The other channels only deliver if they are both switched on *and* configured — push needs a device registered from an installed PWA, which is a separate step from the switch and the one that quietly fails.

| entrant | push | devices | email | SMS |
| --- | --- | --- | --- | --- |
| Alex Beetles | on | **0 — gets no push** | on | off |
| Casra Abedian | on | 1 | on | on |
| Henry Kirby | on | 1 | on | off |
| Nick Petrie | on | 1 | on | on |
| Tom Petrie | on | 1 | on | off |

## Upcoming gameweeks

| GW | deadline | when |
| --- | --- | --- |
| 4 | Sat 12 Sep 2026, 12:30 UTC | in 5d |
| 5 | Fri 18 Sep 2026, 17:30 UTC | in 11d |
| 6 | Sat 10 Oct 2026, 10:00 UTC | in 33d |
| 7 | Sat 17 Oct 2026, 10:00 UTC | in 40d |
| 8 | Fri 23 Oct 2026, 17:30 UTC | in 46d |

## Freshness

| source | last synced | when |
| --- | --- | --- |
| players | Mon 7 Sep 2026, 11:00 UTC | 45m ago |

A stale row here means `sync-fpl` or `score` stopped running — the picker would be showing yesterday's injury flags, and goals would stop arriving. Everything above is only as current as this.
