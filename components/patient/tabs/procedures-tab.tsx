"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProcedureCard } from "@/components/procedure/procedure-card";
import { ProcedureDialog, SignPostDialog } from "@/components/procedure/procedure-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { identifiersFor, type PatientCtx } from "@/components/patient/types";
import { usePermission } from "@/hooks/use-permission";
import { isActiveCycle } from "@/lib/schemas/cycle";
import type { Procedure } from "@/lib/schemas/procedure";
import { useCycleStore } from "@/lib/stores/cycle";
import { useProcedureStore } from "@/lib/stores/procedure";

export function ProceduresTab({ ctx }: { ctx: PatientCtx }) {
  const ep = ctx.episode;
  const canPost = usePermission("procedures.post");
  const allCycles = useCycleStore((s) => s.cycles);
  const procedures = useProcedureStore((s) => s.procedures);
  const [dialog, setDialog] = useState<{ open: boolean; existing?: Procedure }>({ open: false });
  const [signing, setSigning] = useState<Procedure | null>(null);
  const cycles = useMemo(
    () => (ep ? allCycles.filter((c) => c.episodeId === ep.id).sort((a, b) => b.number - a.number) : []),
    [allCycles, ep],
  );
  const list = useMemo(() => {
    const ids = new Set(cycles.map((c) => c.id));
    return procedures
      .filter((p) => ids.has(p.cycleId))
      .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  }, [procedures, cycles]);
  if (!ep) return <EmptyState title="No episode" description="Open an episode first." />;
  if (cycles.length === 0)
    return <EmptyState title="No cycles yet" description="Start a cycle before recording procedures (Cycles tab)." />;
  const active = cycles.find(isActiveCycle) ?? cycles[0];

  return (
    <SectionCard
      title="Procedures"
      description="OCR, PRP, cyst drainage, PGT, ET, FET, andrology and biopsy — one configurable form."
      actions={
        canPost && ep.status !== "closed" ? (
          <Button size="sm" onClick={() => setDialog({ open: true })}>
            <Plus aria-hidden="true" /> New procedure note
          </Button>
        ) : null
      }
    >
      {list.length === 0 ? (
        <EmptyState title="No procedures recorded" description="Create a draft note, then sign and post it." />
      ) : (
        <div className="grid gap-3">
          {list.map((p) => (
            <ProcedureCard
              key={p.id}
              procedure={p}
              canPost={canPost && ep.status !== "closed"}
              onEdit={() => setDialog({ open: true, existing: p })}
              onSign={() => setSigning(p)}
              identifiers={identifiersFor(ctx)}
              branchId={ctx.patient.branchId}
            />
          ))}
        </div>
      )}
      <ProcedureDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        cycles={cycles}
        defaultCycleId={active?.id}
        existing={dialog.existing}
      />
      <SignPostDialog
        procedure={signing}
        open={signing !== null}
        onOpenChange={(o) => (!o ? setSigning(null) : undefined)}
      />
    </SectionCard>
  );
}
