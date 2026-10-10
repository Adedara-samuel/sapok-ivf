import { cn } from "@/lib/utils/cn";

/**
 * RHV (Redeemer's Health Village) logo. `color` sits on a white chip so it reads in light and dark themes;
 * `white` is the full wordmark for dark/brand backgrounds.
 */
export function BrandLogo({ variant = "color", className }: { variant?: "color" | "white"; className?: string }) {
  if (variant === "white") {
    return (
      <img src="/brand/rhv-white.png" alt="RHV — Redeemer's Health Village" className={cn("h-12 w-auto", className)} />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-lg bg-white px-1.5 py-1 shadow-xs ring-1 ring-black/5",
        className,
      )}
    >
      <img src="/brand/rhv-logo.png" alt="RHV" className="h-full w-auto" />
    </span>
  );
}
