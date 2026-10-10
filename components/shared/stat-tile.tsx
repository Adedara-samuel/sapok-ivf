import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const w = 80;
  const h = 24;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * h}`).join(" ");
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h + 2}`}
      className="text-primary overflow-visible"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StatTile({
  label,
  value,
  hint,
  href,
  icon: Icon,
  trend,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  icon?: LucideIcon;
  trend?: number[];
  tone?: "primary" | "rose" | "warning" | "danger";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    rose: "bg-rose/10 text-rose",
    warning: "bg-warning/15 text-warning",
    danger: "bg-destructive/10 text-destructive",
  }[tone];
  const body = (
    <Card className={cn("gap-3 p-4 transition-shadow", href && "hover:border-primary/40 hover:shadow-md")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
        {Icon ? (
          <span className={cn("flex size-8 items-center justify-center rounded-lg", toneClass)}>
            <Icon className="size-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        {trend ? <Sparkline values={trend} /> : null}
      </div>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </Card>
  );
  return href ? (
    <Link
      href={href}
      className="focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none"
      aria-label={`${label}: ${value}. Open list`}
    >
      {body}
    </Link>
  ) : (
    body
  );
}
