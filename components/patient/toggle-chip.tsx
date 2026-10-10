"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Small pressed/unpressed filter chip (accessible toggle button). */
export function Toggle({
  pressed,
  onPressedChange,
  children,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "focus-visible:ring-ring inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
        pressed ? "bg-primary/10 border-primary/40 text-primary" : "text-muted-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
