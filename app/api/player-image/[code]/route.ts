import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { hexToRgb, teamColor } from "@/lib/teamColors";
import { monogramCardSvg } from "@/lib/monogramCard";

export const runtime = "nodejs";

function svgResponse(svg: string) {
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
  });
}

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

  const color = teamColor(player.teams?.short_name ?? "");

  if (!player.photo) {
    return svgResponse(monogramCardSvg(player.web_name, color));
  }

  try {
    const cdnUrl = `https://resources.premierleague.com/premierleague/photos/players/250x250/p${code}.png`;
    const imageRes = await fetch(cdnUrl);
    if (!imageRes.ok) throw new Error(`CDN responded ${imageRes.status}`);
    const sourceBuffer = Buffer.from(await imageRes.arrayBuffer());

    // Posterise the headshot (palette-quantise it) onto the club colour so
    // the whole set reads as one deliberately-styled deck rather than raw
    // scraped photos.
    const { r, g, b } = hexToRgb(color);
    const posterised = await sharp(sourceBuffer)
      .resize(160, 160, { fit: "cover" })
      .png({ palette: true, colors: 10 })
      .toBuffer();

    const card = await sharp({
      create: { width: 200, height: 200, channels: 3, background: { r, g, b } },
    })
      .composite([{ input: posterised, top: 20, left: 20 }])
      .png()
      .toBuffer();

    return new Response(new Uint8Array(card), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    // New signing, CDN reorganised its path again, network hiccup —
    // whatever the reason, always fall back rather than break the card.
    return svgResponse(monogramCardSvg(player.web_name, color));
  }
}
