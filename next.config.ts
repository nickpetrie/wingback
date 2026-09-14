import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The team-sheet image is rasterised by sharp inside the serverless
  // function, and it points at a font file by absolute path rather than
  // asking for one by name — because asking by name is what produced a
  // deployed image with every glyph as a tofu box (see assets/fonts/README).
  //
  // Nothing imports that .ttf, so Next's file tracing cannot see it and would
  // not bundle it. Without this the path resolves to nothing in production and
  // the boxes come straight back.
  outputFileTracingIncludes: {
    "/api/team-sheet/[gameweek]": ["./assets/fonts/*.ttf"],
  },
};

export default nextConfig;
