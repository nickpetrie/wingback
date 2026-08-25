import { createHash, timingSafeEqual } from "node:crypto";

// FPL sits behind Fastly, which refuses Supabase's shared edge-function egress
// IP in bursts — during one every request from that IP gets a 403 in a couple
// of milliseconds, the homepage included, so it is the address being refused
// rather than anything about the request. Vercel's egress is a different
// address, so the edge functions call this route and it makes the FPL request
// on their behalf. See supabase/functions/_shared/fpl.ts.
//
// Node runtime, not edge: `runtime = "edge"` is deprecated as of Next 16.
export const runtime = "nodejs";
export const maxDuration = 60;

// An open proxy would let anyone route traffic through this deployment, so the
// path is allowlisted down to the three URLs the edge functions actually use.
// Anything else is a 404 whether or not the caller knows the secret.
const ALLOWED = [/^bootstrap-static$/, /^fixtures$/, /^event\/\d{1,2}\/live$/];

function secretMatches(sent: string | null): boolean {
  const expected = process.env.FPL_PROXY_SECRET;
  if (!expected || !sent) return false;
  // Hash first so the compared buffers are always the same length —
  // timingSafeEqual throws on a length mismatch, which is itself a leak.
  const a = createHash("sha256").update(sent).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!process.env.FPL_PROXY_SECRET) {
    return Response.json({ error: "proxy not configured" }, { status: 503 });
  }
  if (!secretMatches(request.headers.get("x-wingback-proxy-key"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const joined = (path ?? []).join("/");
  if (!ALLOWED.some((re) => re.test(joined))) {
    return Response.json({ error: "path not allowed" }, { status: 404 });
  }

  // Only `event` is forwarded, and only as an integer: the query string is the
  // other way an allowlisted path could be turned into something else.
  const event = new URL(request.url).searchParams.get("event");
  const query = event && /^\d{1,2}$/.test(event) ? `?event=${event}` : "";
  const upstream = `https://fantasy.premierleague.com/api/${joined}/${query}`;

  let res: Response;
  try {
    res = await fetch(upstream, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "en-GB,en;q=0.9",
        Referer: "https://fantasy.premierleague.com/",
      },
      cache: "no-store",
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  // Streamed straight through rather than buffered: bootstrap-static is ~5MB
  // and reading it into memory here would risk the platform's response size
  // limit for no benefit — nothing in this route inspects the body.
  return new Response(res.body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
      // Names the hop that refused us when it did, matching what fpl.ts logs.
      "X-Fpl-Upstream-Server": res.headers.get("server") ?? "unknown",
      "Cache-Control": "no-store",
    },
  });
}
