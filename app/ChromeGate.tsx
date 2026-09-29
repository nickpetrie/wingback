"use client";

import { usePathname } from "next/navigation";

// Nav renders nothing on these — signed out, or signed in but unclaimed — and
// a header skeleton that then vanished would be the only thing to shift on
// the sign-in screen. The gate is the client half; the skeleton itself stays
// a server component so it ships no script of its own.
const CHROME_FREE = ["/login", "/auth", "/claim"];

export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (CHROME_FREE.some((p) => pathname.startsWith(p))) return null;
  return children;
}
