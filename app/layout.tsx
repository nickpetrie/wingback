import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { Nav } from "./Nav";
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
        <Nav />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
