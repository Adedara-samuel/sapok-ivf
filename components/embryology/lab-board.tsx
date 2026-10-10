"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { z } from "zod";
import { FlaskConical, Pencil, Snowflake, MoveRight } from "lucide-react";
import { NumberField, TextField } from "@/components/forms/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { firstFreeSlot, SlotPicker } from "@/components/embryology/slot-picker";
import { WitnessFields } from "@/components/embryology/witness-fields";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusChip } from "@/components/shared/status-chip";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import type { Embryo } from "@/lib/schemas/embryology";
import { EMBRYO_STAGES } from "@/lib/schemas/embryology";
import { useEmbryologyStore, type SlotInput, type WitnessInput } from "@/lib/stores/embryology";
import { isDomainError } from "@/lib/stores/core";
import { gradeScore } from "@/lib/utils/embryo";
import { cn } from "@/lib/utils/cn";
import type { CycleInfo } from "@/components/embryology/embryology-view";

const gradeForm = z.object({
  day: z.number({ error: "Choose the day" }).int().min(0).max(7),
  grade: z.string().trim().min(1, "Enter a grade, e.g. 4AA or 8-cell G1").max(16),
});
type GradeForm = z.infer<typeof gradeForm>;

type Action = "freeze" | "transferred" | "discarded" | "arrested";

function GradeDialog({ embryo, onClose }: { embryo: Embryo | null; onClose: () => void }) {
  const run = useRunAction();
  const grade = useEmbryologyStore((s) => s.grade);
  const form = useZodForm<GradeForm>(gradeForm, { day: embryo?.day ?? 0, grade: embryo?.grade ?? "" });
  return (
    <Dialog open={embryo !== null} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grade {embryo?.label}</DialogTitle>
          <DialogDescription>
            Gardner grade for blastocysts (e.g. 4AA), cell count and fragmentation grade for cleavage embryos (e.g.
            8-cell G1).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              if (!embryo) return;
              const ok = run(
                () => {
                  grade(embryo.id, v);
                  return true;
                },
                { success: `${embryo.label} graded ${v.grade}`, setError: form.setError },
              );
              if (ok) onClose();
            })}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                control={form.control}
                name="day"
                label="Day"
                step="1"
                min={embryo?.day ?? 0}
                max={7}
                required
                description={EMBRYO_STAGES[form.watch("day") ?? 0]}
              />
              <TextField control={form.control} name="grade" label="Grade" required placeholder="4AA" />
            </div>
            <div className="flex flex-wrap gap-1">
              {["5AA", "4AA", "4AB", "4BB", "3BB", "3BC", "8-cell G1", "8-cell G2", "6-cell G2"].map((g) => (
                <Button
                  key={g}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => form.setValue("grade", g, { shouldValidate: true })}
                >
                  {g}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button type="submit">Save grade</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({ embryo, onClose }: { embryo: Embryo | null; onClose: () => void }) {
  const storage = useEmbryologyStore((s) => s.storage);
  const freeze = useEmbryologyStore((s) => s.freeze);
  const setStatus = useEmbryologyStore((s) => s.setStatus);
  const [action, setAction] = useState<Action>("freeze");
  const [slot, setSlot] = useState<SlotInput>(() => firstFreeSlot(storage));
  const [witness, setWitness] = useState<WitnessInput>({ witnessId: "", pin: "" });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setWitness({ witnessId: "", pin: "" });
    setError(null);
    setNote("");
    onClose();
  };
  const submit = () => {
    if (!embryo) return;
    try {
      if (action === "freeze") freeze(embryo.id, slot, witness);
      else setStatus(embryo.id, action, witness, note || undefined);
      toast.success(
        action === "freeze"
          ? `${embryo.label} vitrified to ${slot.tank}-C${slot.canister}-${slot.goblet}-S${slot.straw}`
          : `${embryo.label} marked ${action}`,
      );
      close();
    } catch (e) {
      setError(isDomainError(e) ? e.message : "Could not update the embryo");
    }
  };
  return (
    <Dialog open={embryo !== null} onOpenChange={(o) => (!o ? close() : undefined)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Move {embryo?.label}</DialogTitle>
          <DialogDescription>
            D{embryo?.day} · {embryo?.grade ?? "ungraded"}. Every status change needs a second embryologist as witness.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={action}
          onValueChange={(v) => setAction(v as Action)}
          className="grid grid-cols-2 gap-2"
          aria-label="Action"
        >
          {(
            [
              ["freeze", "Freeze (vitrify)"],
              ["transferred", "Transferred"],
              ["discarded", "Discard"],
              ["arrested", "Arrested"],
            ] as const
          ).map(([v, l]) => (
            <Label key={v} className="hover:bg-accent flex items-center gap-2 rounded-md border p-2 font-normal">
              <RadioGroupItem value={v} disabled={v === "freeze" && (embryo?.day ?? 0) < 3} /> {l}
            </Label>
          ))}
        </RadioGroup>
        {action === "freeze" ? (
          <SlotPicker value={slot} onChange={setSlot} storage={storage} />
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="move-note">Note</Label>
            <Textarea
              id="move-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional detail for the custody log"
            />
          </div>
        )}
        <WitnessFields value={witness} onChange={setWitness} error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit}>
            <MoveRight aria-hidden="true" /> Confirm with witness
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LabBoard({ cycleInfo, canManage }: { cycleInfo: Map<string, CycleInfo>; canManage: boolean }) {
  const embryos = useEmbryologyStore((s) => s.embryos);
  const addEmbryos = useEmbryologyStore((s) => s.addEmbryos);
  const run = useRunAction();
  const [grading, setGrading] = useState<Embryo | null>(null);
  const [moving, setMoving] = useState<Embryo | null>(null);
  const active = useMemo(
    () => embryos.filter((e) => (e.status === "culturing" || e.status === "thawed") && cycleInfo.has(e.cycleId)),
    [embryos, cycleInfo],
  );
  const pendingOcr = useMemo(
    () =>
      [...cycleInfo.values()].filter(
        (c) =>
          c.cycle.ocr &&
          c.cycle.ocr.fertilised > 0 &&
          c.cycle.stage !== "completed" &&
          c.cycle.stage !== "cancelled" &&
          !embryos.some((e) => e.cycleId === c.cycle.id),
      ),
    [cycleInfo, embryos],
  );

  if (active.length === 0 && pendingOcr.length === 0)
    return (
      <EmptyState
        icon={FlaskConical}
        title="No embryos in culture"
        description="Embryos appear here after oocyte retrieval and fertilisation."
      />
    );

  return (
    <div className="grid gap-4">
      {pendingOcr.length > 0 && canManage ? (
        <div className="grid gap-2 rounded-lg border border-dashed p-3">
          <p className="text-sm font-medium">Fertilisation recorded but no embryos logged</p>
          {pendingOcr.map((c) => (
            <div key={c.cycle.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {c.patientName} · {c.ivfNo} · {c.cycle.ocr?.fertilised} zygotes
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  run(() => addEmbryos(c.cycle.id, c.cycle.ocr?.fertilised ?? 0, c.source), {
                    success: "Embryos logged for culture",
                  })
                }
              >
                Log {c.cycle.ocr?.fertilised} embryos
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => {
          const col = active
            .filter((e) => Math.min(e.day, 6) === d)
            .sort((a, b) => gradeScore(b.grade) - gradeScore(a.grade));
          const groups = [...new Set(col.map((e) => e.cycleId))];
          return (
            <section
              key={d}
              className="bg-muted/30 flex min-h-48 flex-col gap-2 rounded-xl border p-2"
              aria-label={`Day ${d}`}
            >
              <header className="flex items-center justify-between px-1">
                <p className="text-sm font-semibold">D{d}</p>
                <Badge variant="secondary">{col.length}</Badge>
              </header>
              <p className="text-muted-foreground px-1 text-[11px]">{EMBRYO_STAGES[d]}</p>
              {groups.map((cid) => {
                const info = cycleInfo.get(cid);
                return (
                  <div key={cid} className="grid gap-1.5">
                    <Link
                      href={info ? `/patients/${info.patientId}/cycles/${cid}` : "#"}
                      className="text-primary truncate px-1 text-xs font-semibold hover:underline"
                    >
                      {info?.patientName ?? "Patient"} · {info?.ivfNo}
                    </Link>
                    {col
                      .filter((e) => e.cycleId === cid)
                      .map((e) => (
                        <article
                          key={e.id}
                          className={cn(
                            "bg-card grid gap-1 rounded-lg border p-2 text-xs shadow-xs",
                            e.status === "thawed" && "border-warning/50",
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold">{e.label}</span>
                            {e.grade ? (
                              <Badge>{e.grade}</Badge>
                            ) : (
                              <span className="text-muted-foreground">ungraded</span>
                            )}
                          </div>
                          <span className="text-muted-foreground">{e.stage}</span>
                          {e.status === "thawed" ? <StatusChip status="thawed" label="Warmed — for transfer" /> : null}
                          {e.pgtResult !== "not-tested" ? <StatusChip status={e.pgtResult} /> : null}
                          {canManage ? (
                            <div className="flex gap-1">
                              {e.status === "culturing" ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 flex-1 px-1"
                                  onClick={() => setGrading(e)}
                                >
                                  <Pencil className="size-3" aria-hidden="true" /> Grade
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 flex-1 px-1"
                                onClick={() => setMoving(e)}
                              >
                                <Snowflake className="size-3" aria-hidden="true" /> Move
                              </Button>
                            </div>
                          ) : null}
                        </article>
                      ))}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
      <GradeDialog key={grading?.id ?? "g"} embryo={grading} onClose={() => setGrading(null)} />
      <MoveDialog key={moving?.id ?? "m"} embryo={moving} onClose={() => setMoving(null)} />
    </div>
  );
}
