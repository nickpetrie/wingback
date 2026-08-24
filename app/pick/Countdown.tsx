"use client";

import { useEffect, useState } from "react";

function format(msRemaining: number): string {
  if (msRemaining <= 0) return "locked";
  const totalSeconds = Math.floor(msRemaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

const URGENT_THRESHOLD_MS = 60 * 60 * 1000;

export function Countdown({ lockAt }: { lockAt: string }) {
  const target = new Date(lockAt).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(target - Date.now()), 1_000);
    return () => clearInterval(id);
  }, [target]);

  const urgent = remaining > 0 && remaining <= URGENT_THRESHOLD_MS;

  return <span className={urgent ? "animate-pulse text-red-400" : undefined}>{format(remaining)}</span>;
}
