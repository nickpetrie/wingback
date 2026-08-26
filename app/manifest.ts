import type { MetadataRoute } from "next";
import { THEME_BG } from "@/lib/theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wingback",
    short_name: "Wingback",
    description: "Season-long Premier League goalscorer sweepstake",
    start_url: "/",
    display: "standalone",
    background_color: THEME_BG.light,
    theme_color: THEME_BG.light,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Android crops icons to its own shape; the maskable one has the padding
      // to survive that.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
