"use client";

import { Check } from "lucide-react";
import { STAGE_LABELS } from "@/lib/constants/clinical";
import { FROZEN_STAGE_ORDER, STAGE_ORDER, type Cycle, type CycleStage } from "@/lib/schemas/cycle";
import { cn } from "@/lib/utils/cn";

export function stagesFor(cycle: Pick<Cycle, "kind" | "protocol">): readonly CycleStage[] {
  if (cycle.kind === "frozen") return FROZEN_STAGE_ORDER;
  if (cycle.protocol === "long-agonist") return STAGE_ORDER;
  return STAGE_ORDER.filter((st) => st !== "downreg");
}

/** Horizontal stage stepper (baseline → outcome). Clicking a step moves the cycle when allowed. */
export function StageStepper({
  cycle,
  onSelect,
  disabled,
}: {
  cycle: Cycle;
  onSelect?: (s: CycleStage) => void;
  disabled?: boolean;
}) {
  const stages = stagesFor(cycle);
  const idx = cycle.stage === "cancelled" ? -1 : stages.indexOf(cycle.stage);
  return (
    <nav aria-label="Cycle stages" className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1">
        {stages.map((s, i) => {
          const done = idx > i;
          const current = idx === i;
          return (
            <li key={s} className="flex items-center gap-1">
              <button
                type="button"
                disabled={disabled || !onSelect}
                onClick={() => onSelect?.(s)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default",
                  done && "bg-primary/10 border-primary/30 text-primary",
                  current && "bg-primary text-primary-foreground border-primary",
                  !done && !current && "text-muted-foreground",
                  !disabled && onSelect && !current && "hover:border-primary/50",
                )}
              >
                {done ? <Check className="size-3" aria-hidden="true" /> : <span className="tabular-nums">{i + 1}</span>}
                {STAGE_LABELS[s]}
              </button>
              {i < stages.length - 1 ? (
                <span className={cn("h-px w-4", done ? "bg-primary/50" : "bg-border")} aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
        {cycle.stage === "cancelled" ? (
          <li className="text-destructive ml-2 text-xs font-semibold">Cancelled</li>
        ) : null}
      </ol>
    </nav>
  );
}
