"use client";

import { useActiveTenant } from "@/hooks/use-tenant";
import { cn } from "@/lib/utils/cn";

function HeartMark({ variant, className }: { variant: "color" | "white"; className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={cn(
        "aspect-square h-full rounded-full p-1",
        variant === "white" ? "text-primary bg-white" : "bg-primary text-primary-foreground",
        className,
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
  );
}

/** The platform's own mark (super-admin console, marketing). */
export function PlatformLogo({ className, variant = "color" }: { className?: string; variant?: "color" | "white" }) {
  return (
    <span
      role="img"
      aria-label="Overcare platform"
      className={cn("inline-flex shrink-0 items-center gap-2", className)}
    >
      <HeartMark variant={variant} />
      <span className={cn("leading-none", variant === "white" ? "text-white" : "text-foreground")}>
        <span className="block font-semibold tracking-tight">Overcare</span>
        <span className="mt-1 block text-[0.55em] font-semibold tracking-[0.24em] uppercase">Platform</span>
      </span>
    </span>
  );
}

/** The current hospital's logo: its uploaded image if it has one, otherwise the default mark with its name. */
export function BrandLogo({
  variant = "color",
  compact = false,
  className,
}: {
  variant?: "color" | "white";
  compact?: boolean;
  className?: string;
}) {
  const tenant = useActiveTenant();
  const name = tenant?.name ?? "Overcare IVF";
  const [first, ...rest] = (tenant?.shortName ?? "Overcare IVF").split(" ");
  return (
    <span role="img" aria-label={name} className={cn("inline-flex shrink-0 items-center gap-2", className)}>
      {tenant?.logoDataUrl ? (
        <img
          src={tenant.logoDataUrl}
          alt=""
          className={cn(
            "aspect-square h-full rounded-full object-contain",
            variant === "white" ? "bg-white p-0.5" : "bg-card",
          )}
        />
      ) : (
        <HeartMark variant={variant} />
      )}
      {compact ? null : (
        <span className={cn("leading-none", variant === "white" ? "text-white" : "text-foreground")}>
          <span className="block font-semibold tracking-tight">{first}</span>
          {rest.length > 0 ? (
            <span className="mt-1 block text-[0.55em] font-semibold tracking-[0.24em] uppercase">{rest.join(" ")}</span>
          ) : null}
        </span>
      )}
    </span>
  );
}
