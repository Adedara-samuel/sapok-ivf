"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { NumberField, SelectField, TextField, TextareaField, DateField, TimeField } from "@/components/forms/fields";
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
import { SignaturePad } from "@/components/shared/signature-pad";
import { confirmDiscard } from "@/hooks/use-unsaved-guard";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { isoDate } from "@/lib/schemas/common";
import type { Cycle } from "@/lib/schemas/cycle";
import { ProcedureType, type Procedure } from "@/lib/schemas/procedure";
import { postProcedure } from "@/lib/services/workflows";
import { useProcedureStore } from "@/lib/stores/procedure";
import { useSettingsStore } from "@/lib/stores/settings";
import { useStaffStore } from "@/lib/stores/staff";
import { formatTime, nowIso, todayIso } from "@/lib/utils/dates";

const procForm = z.object({
  type: ProcedureType,
  cycleId: z.string().min(1, "Choose the cycle"),
  date: isoDate,
  time: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm"),
  surgeonId: z.string().min(1, "Choose the surgeon/operator"),
  embryologistId: z.string().optional(),
  scrubNurseId: z.string().optional(),
  count: z.number().int().nonnegative().optional(),
  embryoGrade: z.string().optional(),
  embryosTransferred: z.number().int().min(0).max(3).optional(),
  postOpNote: z.string().trim().min(3, "Write a post-op note or remark"),
});
type ProcForm = z.infer<typeof procForm>;

/** Create or edit a draft procedure note using the configurable form engine. */
export function ProcedureDialog({
  open,
  onOpenChange,
  cycles,
  defaultCycleId,
  existing,
  defaultType = "OCR",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cycles: Cycle[];
  defaultCycleId?: string;
  existing?: Procedure;
  defaultType?: Procedure["type"];
}) {
  const run = useRunAction();
  const saveDraft = useProcedureStore((s) => s.saveDraft);
  const forms = useSettingsStore((s) => s.procedureForms);
  const staff = useStaffStore((s) => s.staff);
  const blank = (type: Procedure["type"]): ProcForm => ({
    type,
    cycleId: defaultCycleId ?? cycles[0]?.id ?? "",
    date: todayIso(),
    time: formatTime(nowIso()),
    surgeonId: "",
    postOpNote: forms.find((f) => f.type === type)?.noteTemplate ?? "",
  });
  const form = useZodForm<ProcForm>(procForm, blank(defaultType));
  useEffect(() => {
    if (!open) return;
    if (existing) {
      form.reset({
        type: existing.type,
        cycleId: existing.cycleId,
        date: existing.date,
        time: existing.time,
        surgeonId: existing.surgeonId,
        embryologistId: existing.embryologistId,
        scrubNurseId: existing.scrubNurseId,
        count: existing.count,
        embryoGrade: existing.embryoGrade,
        embryosTransferred: existing.embryosTransferred,
        postOpNote: existing.postOpNote,
      });
    } else form.reset(blank(defaultType));
  }, [open, existing]); // eslint-disable-line react-hooks/exhaustive-deps

  const type = form.watch("type");
  const cfg = forms.find((f) => f.type === type);
  const people = (role: string) =>
    staff.filter((s) => s.role === role && s.active).map((s) => ({ value: s.id, label: s.name }));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o || confirmDiscard(form.formState.isDirty) ? onOpenChange(o) : undefined)}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit draft procedure note" : "New procedure note"}</DialogTitle>
          <DialogDescription>
            Save as a draft, then sign and post. Posted notes are locked; corrections are added as addenda.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              const res = run(
                () =>
                  saveDraft(
                    {
                      ...v,
                      embryologistId: cfg?.showEmbryologist ? v.embryologistId || undefined : undefined,
                      scrubNurseId: cfg?.showScrubNurse ? v.scrubNurseId || undefined : undefined,
                      count: cfg?.countLabel ? v.count : undefined,
                      embryoGrade: cfg?.showEmbryoGrade ? v.embryoGrade || undefined : undefined,
                      embryosTransferred: cfg?.showTransferred ? v.embryosTransferred : undefined,
                    },
                    existing?.id,
                  ),
                { success: "Draft saved", setError: form.setError },
              );
              if (res) {
                form.reset(form.getValues());
                onOpenChange(false);
              }
            })}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="type"
                label="Procedure"
                required
                disabled={Boolean(existing)}
                options={forms.map((f) => ({ value: f.type, label: f.label }))}
              />
              <SelectField
                control={form.control}
                name="cycleId"
                label="Cycle"
                required
                options={cycles.map((c) => ({ value: c.id, label: `Cycle ${c.number} (${c.kind}, ${c.protocol})` }))}
              />
              <DateField control={form.control} name="date" label="Date" required />
              <TimeField control={form.control} name="time" label="Time" required />
              <SelectField
                control={form.control}
                name="surgeonId"
                label={type === "ANDROLOGY" || type === "BIOPSY" ? "Urologist / operator" : "Surgeon"}
                required
                options={people("doctor")}
              />
              {cfg?.showEmbryologist ? (
                <SelectField
                  control={form.control}
                  name="embryologistId"
                  label="Embryologist"
                  options={people("embryologist")}
                  allowEmpty
                />
              ) : null}
              {cfg?.showScrubNurse ? (
                <SelectField
                  control={form.control}
                  name="scrubNurseId"
                  label="Scrub nurse"
                  options={people("nurse")}
                  allowEmpty
                />
              ) : null}
              {cfg?.countLabel ? (
                <NumberField control={form.control} name="count" label={cfg.countLabel} step="1" min={0} />
              ) : null}
              {cfg?.showEmbryoGrade ? (
                <TextField
                  control={form.control}
                  name="embryoGrade"
                  label="Embryo grade(s)"
                  placeholder="e.g. 4AA, 4AB"
                />
              ) : null}
              {cfg?.showTransferred ? (
                <NumberField
                  control={form.control}
                  name="embryosTransferred"
                  label="Embryos transferred"
                  step="1"
                  min={0}
                  max={3}
                />
              ) : null}
            </div>
            <TextareaField
              control={form.control}
              name="postOpNote"
              label={cfg?.noteLabel ?? "Post-op note"}
              rows={4}
              required
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Save draft</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/** Sign & post: captures a drawn signature and locks the note. */
export function SignPostDialog({
  procedure,
  open,
  onOpenChange,
}: {
  procedure: Procedure | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const run = useRunAction();
  const [sig, setSig] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setSig("");
          setError(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign and post {procedure?.type} note</DialogTitle>
          <DialogDescription>
            Once posted the note cannot be edited. Corrections must be added as addenda.
          </DialogDescription>
        </DialogHeader>
        <SignaturePad
          onChange={setSig}
          label="Surgeon's signature"
          invalid={Boolean(error)}
          describedBy={error ? "sig-error" : undefined}
        />
        {error ? (
          <p id="sig-error" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!procedure) return;
              if (!sig) {
                setError("Please sign before posting.");
                return;
              }
              if (run(() => postProcedure(procedure.id, sig), { success: `${procedure.type} note signed and posted` }))
                onOpenChange(false);
            }}
          >
            Sign & post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
