// Procedural fallback for a player with no usable headshot (new signings,
// mostly). No AI-generated likeness involved — just initials on a club-
// coloured card, in the same spirit as the posterised real photos.
export function monogramCardSvg(webName: string, teamColorHex: string): string {
  const initials = webName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect width="200" height="200" rx="16" fill="${teamColorHex}" />
  <circle cx="100" cy="90" r="52" fill="rgba(255,255,255,0.15)" />
  <text x="100" y="112" font-family="system-ui, sans-serif" font-size="56" font-weight="700"
        fill="#fff" text-anchor="middle">${initials}</text>
</svg>`;
}
