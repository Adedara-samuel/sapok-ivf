"use client";

import { DateRangeFields } from "@/components/shared/date-range-fields";
import { useMemo, useState } from "react";
import {
  Activity,
  FileSignature,
  FlaskConical,
  HeartPulse,
  NotebookPen,
  Pill,
  Scissors,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Toggle } from "@/components/patient/toggle-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import type { PatientCtx } from "@/components/patient/types";
import { useLookups } from "@/hooks/use-lookups";
import { usePermission } from "@/hooks/use-permission";
import { vitalFlags } from "@/lib/schemas/clinical";
import { useBillingStore } from "@/lib/stores/billing";
import { useClinicalStore } from "@/lib/stores/clinical";
import { useConsentStore } from "@/lib/stores/consent";
import { useCycleStore } from "@/lib/stores/cycle";
import { useOrderStore } from "@/lib/stores/orders";
import { useProcedureStore } from "@/lib/stores/procedure";
import { formatDateTime, isWithin, lagosDateTime } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

type Kind = "note" | "order" | "result" | "procedure" | "vitals" | "payment" | "consent" | "stimulation";

const KINDS: { kind: Kind; label: string; icon: LucideIcon; color: string }[] = [
  { kind: "note", label: "Notes", icon: NotebookPen, color: "text-primary bg-primary/10" },
  { kind: "order", label: "Orders", icon: Pill, color: "text-info bg-info/10" },
  { kind: "result", label: "Results", icon: FlaskConical, color: "text-success bg-success/10" },
  { kind: "procedure", label: "Procedures", icon: Scissors, color: "text-rose bg-rose/10" },
  { kind: "vitals", label: "Vitals", icon: HeartPulse, color: "text-warning bg-warning/15" },
  { kind: "stimulation", label: "Monitoring", icon: Activity, color: "text-primary bg-primary/10" },
  { kind: "payment", label: "Payments", icon: Wallet, color: "text-success bg-success/10" },
  { kind: "consent", label: "Consents", icon: FileSignature, color: "text-muted-foreground bg-muted" },
];

interface Event {
  id: string;
  kind: Kind;
  at: string;
  title: string;
  body?: string;
  flag?: boolean;
}

export function TimelineTab({ ctx }: { ctx: PatientCtx }) {
  const ep = ctx.episode;
  const { staffName } = useLookups();
  const canBilling = usePermission("billing.view");
  const notes = useClinicalStore((s) => s.notes);
  const vitals = useClinicalStore((s) => s.vitals);
  const stimulation = useClinicalStore((s) => s.stimulation);
  const orders = useOrderStore((s) => s.orders);
  const procedures = useProcedureStore((s) => s.procedures);
  const cycles = useCycleStore((s) => s.cycles);
  const payments = useBillingStore((s) => s.payments);
  const consents = useConsentStore((s) => s.consents);
  const [active, setActive] = useState<Set<Kind>>(new Set(KINDS.map((k) => k.kind)));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const events = useMemo<Event[]>(() => {
    if (!ep) return [];
    const cycleIds = new Set(cycles.filter((c) => c.episodeId === ep.id).map((c) => c.id));
    const list: Event[] = [];
    notes
      .filter((n) => n.episodeId === ep.id)
      .forEach((n) =>
        list.push({
          id: n.id,
          kind: "note",
          at: n.createdAt,
          title: `${n.addendumOf ? "Addendum" : `${n.kind[0]?.toUpperCase()}${n.kind.slice(1)} note`} · ${staffName(n.authorId)}`,
          body: n.body,
        }),
      );
    orders
      .filter((o) => o.episodeId === ep.id)
      .forEach((o) => {
        list.push({
          id: `${o.id}-o`,
          kind: "order",
          at: o.at,
          title: `${o.status === "cancelled" ? "Cancelled" : "Ordered"}: ${o.name}${o.qty > 1 ? ` × ${o.qty}` : ""}`,
          body: o.cancelReason ?? (o.dosage ? `${o.dosage} ${o.frequency} for ${o.duration}` : undefined),
        });
        if (o.resultedAt && o.resultText)
          list.push({
            id: `${o.id}-r`,
            kind: "result",
            at: o.resultedAt,
            title: `Result: ${o.name}`,
            body: o.resultText,
            flag: o.abnormal || o.critical,
          });
      });
    procedures
      .filter((p) => cycleIds.has(p.cycleId))
      .forEach((p) =>
        list.push({
          id: p.id,
          kind: "procedure",
          at: p.signedAt ?? lagosDateTime(p.date, p.time),
          title: `${p.type} ${p.status === "posted" ? "posted" : "draft"} · ${staffName(p.surgeonId)}`,
          body: p.postOpNote,
        }),
      );
    vitals
      .filter((v) => v.episodeId === ep.id)
      .forEach((v) => {
        const flags = vitalFlags(v);
        list.push({
          id: v.id,
          kind: "vitals",
          at: v.at,
          title: `${v.phase} vitals`,
          body: `P ${v.pulse} · R ${v.resp} · BP ${v.bpSys}/${v.bpDia} · T ${v.tempC}°C · SpO₂ ${v.spo2}%`,
          flag: flags.length > 0,
        });
      });
    stimulation
      .filter((s) => cycleIds.has(s.cycleId))
      .forEach((s) =>
        list.push({
          id: s.id,
          kind: "stimulation",
          at: lagosDateTime(s.date, "09:00"),
          title: s.scanDay,
          body: `R ${s.follicles.right.join(", ") || "—"} · L ${s.follicles.left.join(", ") || "—"} · ET ${s.endometriumMm ?? "—"} mm${s.e2 ? ` · E2 ${s.e2}` : ""}${s.remark ? ` — ${s.remark}` : ""}`,
        }),
      );
    if (canBilling)
      payments
        .filter((p) => p.episodeId === ep.id)
        .forEach((p) =>
          list.push({
            id: p.id,
            kind: "payment",
            at: p.at,
            title: `Payment ${formatMoney(p.amount)} (${p.method})`,
            body: p.receiptNo,
          }),
        );
    consents
      .filter((c) => c.episodeId === ep.id)
      .forEach((c) =>
        list.push({
          id: c.id,
          kind: "consent",
          at: c.signedAt,
          title: `Consent signed: ${c.template} (${c.version})`,
          body: `Signed by ${c.signerName}${c.witnessName ? `, witnessed by ${c.witnessName}` : ""}`,
        }),
      );
    return list.sort((a, b) => b.at.localeCompare(a.at));
  }, [ep, notes, vitals, stimulation, orders, procedures, cycles, payments, consents, staffName, canBilling]);

  const visible = events.filter(
    (e) =>
      active.has(e.kind) && (!from && !to ? true : isWithin(e.at.slice(0, 10), from || undefined, to || undefined)),
  );

  return (
    <SectionCard title="Timeline" description="Everything that happened in this episode, newest first.">
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Event types">
          {KINDS.filter((k) => k.kind !== "payment" || canBilling).map((k) => (
            <Toggle
              key={k.kind}
              pressed={active.has(k.kind)}
              onPressedChange={(on) =>
                setActive((s) => {
                  const n = new Set(s);
                  if (on) n.add(k.kind);
                  else n.delete(k.kind);
                  return n;
                })
              }
            >
              <k.icon className="size-3.5" aria-hidden="true" /> {k.label}
            </Toggle>
          ))}
        </div>
        <div className="ml-auto flex items-end gap-2">
          <DateRangeFields idPrefix="tl" from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        </div>
      </div>
      {visible.length === 0 ? (
        <EmptyState title="No events" description="Adjust the filters, or start by adding a note or order." />
      ) : (
        <ol className="relative ml-3 border-l pl-6">
          {visible.map((e) => {
            const k = KINDS.find((x) => x.kind === e.kind) ?? KINDS[0];
            const Icon = k?.icon ?? NotebookPen;
            return (
              <li key={e.id} className="mb-5 last:mb-0">
                <span
                  className={cn(
                    "ring-background absolute -left-3.5 flex size-7 items-center justify-center rounded-full ring-4",
                    k?.color,
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {e.title}
                  {e.flag ? <span className="text-destructive text-xs font-semibold">⚠ Flagged</span> : null}
                </p>
                <p className="text-muted-foreground text-xs">{formatDateTime(e.at)}</p>
                {e.body ? <p className="mt-1 text-sm whitespace-pre-line">{e.body}</p> : null}
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}
