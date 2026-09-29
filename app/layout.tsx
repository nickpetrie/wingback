import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Archivo } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { THEME_BG, THEME_INIT_SCRIPT } from "@/lib/theme";
import { ChromeGate } from "./ChromeGate";
import { InstallPrompt } from "./InstallPrompt";
import { Nav } from "./Nav";
import { HeaderSkeleton } from "./Skeleton";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  weight: ["400", "600", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://wingbacksweepstake.website"),
  title: "Wingback",
  description: "Season-long Premier League goalscorer sweepstake",
  appleWebApp: { capable: true, title: "Wingback", statusBarStyle: "black-translucent" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Load-bearing for every env(safe-area-inset-*) in globals.css: without
  // viewport-fit=cover they all evaluate to 0, and with the status bar set to
  // black-translucent above, the header sits under the clock and the Dynamic
  // Island once the app is installed.
  viewportFit: "cover",
  // One entry per scheme so the chrome is the right colour before the theme
  // script has run; the script then repaints both with the chosen theme, which
  // may not be the OS's (lib/theme.ts).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_BG.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_BG.dark },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script below sets data-theme on this
    // element before React hydrates, so the server's markup deliberately differs.
    <html lang="en" className={`${archivo.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Nav is four sequential Supabase hops before it can render anything,
            and without a boundary here nothing below it — not even a page's
            loading.tsx — could paint until they had all resolved. The fallback
            is the header's exact box, so the page doesn't shift when it lands. */}
        <Suspense
          fallback={
            <ChromeGate>
              <HeaderSkeleton />
            </ChromeGate>
          }
        >
          <Nav />
        </Suspense>
        {children}
        <InstallPrompt />
        <Analytics />
      </body>
    </html>
  );
}
