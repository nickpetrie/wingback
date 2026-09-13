import { Avatar } from "../Avatar";
import type { AwardResult, SeasonAwards as SeasonAwardsData } from "@/lib/awards";

export interface AwardEntrant {
  id: string;
  name: string;
  avatar_updated_at: string | null;
}

// Copy lives here, not in lib/awards.ts — that module only knows entrant
// ids and numbers, the same split prize.ts keeps between the derivation and
// the words on the page in app/leaderboard/page.tsx.
const AWARD_COPY: {
  key: keyof SeasonAwardsData;
  title: string;
  blurb: (value: number) => string;
  none: string;
}[] = [
  {
    key: "vulture",
    title: "The Vulture",
    blurb: (v) => `${v} pt${v === 1 ? "" : "s"} from gameweeks where they were the only one on their pick.`,
    none: "Every exclusive pick blanked — nobody fed off one alone.",
  },
  {
    key: "sheep",
    title: "The Sheep",
    blurb: (v) => `Matched by someone else's pick in ${v} gameweek${v === 1 ? "" : "s"}.`,
    none: "Nobody ever doubled up on the same player.",
  },
  {
    key: "nostradamus",
    title: "Nostradamus",
    blurb: (v) => `${v} gameweek${v === 1 ? "" : "s"} running with a scoring pick.`,
    none: "No pick scored all season.",
  },
  {
    key: "iceCold",
    title: "Ice Cold",
    blurb: (v) => `${v} gameweek${v === 1 ? "" : "s"} running holding a pick that scored nothing.`,
    none: "Nobody held a blank all season.",
  },
  {
    key: "cautious",
    title: "The Cautious",
    blurb: (v) => `${v} pt${v === 1 ? "" : "s"} scored at the base £3 stake.`,
    none: "Nobody scored a point at the base stake.",
  },
  {
    key: "deadlineDan",
    title: "Deadline Dan",
    blurb: (v) => `${v} pick${v === 1 ? "" : "s"} filed in the last hour before lock.`,
    none: "Nobody cut it that fine all season.",
  },
];

/**
 * The season's derived titles — only ever passed a non-null `awards` once
 * every gameweek has finished (see isSeasonComplete in lib/awards.ts), so
 * there is no "so far" reading of these: a run or a total shown here is the
 * one the season actually ended on.
 */
export function SeasonAwards({
  awards,
  entrants,
}: {
  awards: SeasonAwardsData | null;
  entrants: AwardEntrant[];
}) {
  if (!awards) return null;

  const byId = new Map(entrants.map((e) => [e.id, e]));

  return (
    <div className="wb-awards">
      <p className="wb-awards-label">Season awards</p>
      <div className="wb-awards-grid">
        {AWARD_COPY.map(({ key, title, blurb, none }) => (
          <AwardCard key={key} title={title} result={awards[key]} blurb={blurb} none={none} byId={byId} />
        ))}
      </div>
    </div>
  );
}

function AwardCard({
  title,
  result,
  blurb,
  none,
  byId,
}: {
  title: string;
  result: AwardResult;
  blurb: (value: number) => string;
  none: string;
  byId: Map<string, AwardEntrant>;
}) {
  const winners = result.winners.map((id) => byId.get(id)).filter((e): e is AwardEntrant => e !== undefined);

  return (
    <div className="wb-award">
      <p className="wb-award-title">{title}</p>
      <p className="wb-award-blurb">{winners.length > 0 ? blurb(result.value) : none}</p>
      {/* No separate "no winner" line: the blurb above already says nobody
          managed it, and printing both said it twice. */}
      {winners.length > 0 && (
        <div className="wb-award-who">
          {winners.map((e) => (
            <span className="wb-award-winner" key={e.id}>
              <Avatar entrantId={e.id} name={e.name} updatedAt={e.avatar_updated_at} size={22} />
              <span className="wb-award-winner-name">{e.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
