"use client";

import { useSyncExternalStore } from "react";

function format(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function subscribe(onChange: () => void): () => void {
  const id = window.setInterval(onChange, 1000);
  return () => window.clearInterval(id);
}

const getSnapshot = () => format(new Date());
const getServerSnapshot = () => null;

/** Local wall clock. Renders a placeholder on the server so hydration never mismatches. */
export function LiveClock({ className }: { className?: string }) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <time className={className} aria-label="Current time">
      {now ?? "--:--:--"}
    </time>
  );
}
