import sharp from "sharp";
import { hexToRgb, teamColor } from "@/lib/teamColors";
import { monogramCardSvg } from "@/lib/monogramCard";

const CARD_SIZE = 200;

const photoUrl = (code: number) =>
  `https://resources.premierleague.com/premierleague/photos/players/250x250/p${code}.png`;

export interface PlayerCardInput {
  code: number;
  webName: string;
  photo: string | null;
  teamShortName: string;
}

/**
 * The posterised-headshot-on-club-colour card, or the monogram fallback —
 * always a PNG buffer, even for the fallback, so a caller compositing
 * several of these (the team sheet) never has to branch on format. This is
 * the same posterise-then-composite pass `/api/player-image` used to run
 * inline; it's shared now so the team sheet doesn't reimplement it.
 */
export async function renderPlayerCard({
  code,
  webName,
  photo,
  teamShortName,
}: PlayerCardInput): Promise<Buffer> {
  const color = teamColor(teamShortName);

  if (photo) {
    try {
      const imageRes = await fetch(photoUrl(code));
      if (!imageRes.ok) throw new Error(`CDN responded ${imageRes.status}`);
      const sourceBuffer = Buffer.from(await imageRes.arrayBuffer());

      const { r, g, b } = hexToRgb(color);
      const posterised = await sharp(sourceBuffer)
        .resize(160, 160, { fit: "cover" })
        .png({ palette: true, colors: 10 })
        .toBuffer();

      return await sharp({
        create: { width: CARD_SIZE, height: CARD_SIZE, channels: 3, background: { r, g, b } },
      })
        .composite([{ input: posterised, top: 20, left: 20 }])
        .png()
        .toBuffer();
    } catch {
      // New signing, CDN reorganised its path again, network hiccup —
      // whatever the reason, always fall back rather than break the card.
    }
  }

  return sharp(Buffer.from(monogramCardSvg(webName, color))).png().toBuffer();
}
