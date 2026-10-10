import { cn } from "@/lib/utils/cn";

export type Tone = "waiting" | "progress" | "done" | "cancelled" | "critical" | "info" | "rose" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  waiting: "bg-warning/12 text-[color-mix(in_oklab,var(--warning)_55%,var(--foreground))] border-warning/30",
  progress: "bg-info/12 text-[color-mix(in_oklab,var(--info)_60%,var(--foreground))] border-info/30",
  done: "bg-success/12 text-[color-mix(in_oklab,var(--success)_55%,var(--foreground))] border-success/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  critical:
    "bg-destructive/12 text-[color-mix(in_oklab,var(--destructive)_65%,var(--foreground))] border-destructive/30",
  info: "bg-primary/10 text-[color-mix(in_oklab,var(--primary)_70%,var(--foreground))] border-primary/25",
  rose: "bg-rose/10 text-[color-mix(in_oklab,var(--rose)_65%,var(--foreground))] border-rose/25",
  neutral: "bg-secondary text-secondary-foreground border-border",
};

const DOT_CLASSES: Record<Tone, string> = {
  waiting: "bg-warning",
  progress: "bg-info",
  done: "bg-success",
  cancelled: "bg-muted-foreground",
  critical: "bg-destructive",
  info: "bg-primary",
  rose: "bg-rose",
  neutral: "bg-muted-foreground",
};

/** Consistent status semantics across the app (colour + text, never colour alone). */
const STATUS_TONES: Record<string, Tone> = {
  waiting: "waiting",
  called: "progress",
  "in-consultation": "progress",
  completed: "done",
  "no-show": "cancelled",
  open: "progress",
  "on-hold": "waiting",
  closed: "cancelled",
  registered: "neutral",
  ordered: "waiting",
  "in-progress": "progress",
  resulted: "done",
  dispensed: "done",
  cancelled: "cancelled",
  draft: "waiting",
  posted: "done",
  unpaid: "critical",
  "part-paid": "waiting",
  paid: "done",
  waived: "cancelled",
  pending: "waiting",
  approved: "done",
  rejected: "critical",
  submitted: "progress",
  available: "done",
  matched: "rose",
  "in-cycle": "progress",
  screening: "waiting",
  retired: "cancelled",
  pregnant: "rose",
  delivered: "done",
  culturing: "progress",
  transferred: "rose",
  cryopreserved: "info",
  thawed: "waiting",
  discarded: "cancelled",
  arrested: "cancelled",
  eligible: "done",
  ineligible: "critical",
  negative: "done",
  positive: "critical",
  cleared: "done",
  failed: "critical",
  normal: "done",
  abnormal: "critical",
  clear: "done",
  carrier: "waiting",
  signed: "done",
  euploid: "done",
  aneuploid: "critical",
  mosaic: "waiting",
  "not-tested": "neutral",
  "live-birth": "rose",
  ongoing: "rose",
  "clinical-pregnancy": "rose",
  biochemical: "waiting",
  miscarriage: "critical",
  critical: "critical",
  expired: "critical",
  expiring: "waiting",
};

export function toneFor(status: string): Tone {
  return STATUS_TONES[status] ?? "neutral";
}

export function humanize(value: string): string {
  const s = value.replace(/[-_]/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StatusChip({
  status,
  label,
  tone,
  className,
}: {
  status: string;
  label?: string;
  tone?: Tone;
  className?: string;
}) {
  const t = tone ?? toneFor(status);
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[t],
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASSES[t])} aria-hidden="true" />
      {label ?? humanize(status)}
    </span>
  );
}
