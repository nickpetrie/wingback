"use client";

import { useEffect, useState } from "react";

function format(msRemaining: number): string {
  if (msRemaining <= 0) return "locked";
  const totalMinutes = Math.floor(msRemaining / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const URGENT_THRESHOLD_MS = 60 * 60 * 1000;

export function Countdown({ lockAt }: { lockAt: string }) {
  const target = new Date(lockAt).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(target - Date.now()), 30_000);
    return () => clearInterval(id);
  }, [target]);

  const urgent = remaining > 0 && remaining <= URGENT_THRESHOLD_MS;

  return <span className={urgent ? "animate-pulse text-red-400" : undefined}>{format(remaining)}</span>;
}
