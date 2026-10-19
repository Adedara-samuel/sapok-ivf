import { cn } from "@/lib/utils/cn";

export function BrandLogo({
  variant = "color",
  compact = false,
  className,
}: {
  variant?: "color" | "white";
  compact?: boolean;
  className?: string;
}) {
  return (
    <span role="img" aria-label="Overcare IVF" className={cn("inline-flex shrink-0 items-center gap-2", className)}>
      <svg
        viewBox="0 0 40 40"
        aria-hidden="true"
        className={cn(
          "aspect-square h-full rounded-full p-1",
          variant === "white" ? "bg-white text-primary" : "bg-primary text-primary-foreground",
        )}
      >
        <path
          d="M20 31c-6-3.2-10-7.2-10-12a5.5 5.5 0 0 1 10-3 5.5 5.5 0 0 1 10 3c0 4.8-4 8.8-10 12Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        <path d="M20 27V18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
      </svg>
      {compact ? null : (
        <span className={cn("leading-none", variant === "white" ? "text-white" : "text-foreground")}>
          <span className="block font-semibold tracking-tight">Overcare</span>
          <span className="mt-1 block text-[0.55em] font-semibold tracking-[0.24em] uppercase">IVF</span>
        </span>
      )}
    </span>
  );
}
