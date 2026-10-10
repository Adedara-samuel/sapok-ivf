"use client";

import { useEffect, useMemo } from "react";
import { z } from "zod";
import { NumberField, TextareaField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip } from "@/components/shared/status-chip";
import type { PatientCtx } from "@/components/patient/types";
import { useLookups } from "@/hooks/use-lookups";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useZodForm } from "@/hooks/use-zod-form";
import { EPISODE_TYPE_LABELS, OUTCOME_LABELS } from "@/lib/constants/clinical";
import { useClinicalStore } from "@/lib/stores/clinical";
import { useCycleStore } from "@/lib/stores/cycle";
import { formatDate, formatDateTime } from "@/lib/utils/dates";

const n = z.number({ error: "Enter a number" }).int().nonnegative();
const historyForm = z.object({
  obstetric: z.object({ gravida: n, para: n, living: n, miscarriages: n, ectopic: n }),
  gynaecological: z.string(),
  surgical: z.string(),
  medical: z.string(),
  drugAllergy: z.string(),
  family: z.string(),
  semen: z.string(),
});
type HistoryForm = z.infer<typeof historyForm>;

const EMPTY: HistoryForm = {
  obstetric: { gravida: 0, para: 0, living: 0, miscarriages: 0, ectopic: 0 },
  gynaecological: "",
  surgical: "",
  medical: "",
  drugAllergy: "",
  family: "",
  semen: "",
};

export function HistoryTab({ ctx }: { ctx: PatientCtx }) {
  const run = useRunAction();
  const { staffName } = useLookups();
  const canClinical = usePermission("clinical.view");
  const canPatients = usePermission("patients.edit");
  const canDoctorNotes = usePermission("notes.doctor");
  const canNurseNotes = usePermission("notes.nurse");
  const canEdit = canClinical && canPatients;
  const canEditClinical = canDoctorNotes || canNurseNotes;
  const histories = useClinicalStore((s) => s.histories);
  const save = useClinicalStore((s) => s.saveHistory);
  const cycles = useCycleStore((s) => s.cycles);
  const existing = histories.find((h) => h.personId === ctx.patient.id);
  const form = useZodForm<HistoryForm>(historyForm, existing ?? EMPTY);
  useUnsavedGuard(form.formState.isDirty);
  useEffect(() => {
    form.reset(existing ? { ...existing } : EMPTY);
  }, [existing?.id, existing?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const past = useMemo(() => {
    const ids = new Set(ctx.episodes.map((e) => e.id));
    return cycles.filter((c) => ids.has(c.episodeId)).sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [cycles, ctx.episodes]);
  const editable = canEdit || canEditClinical;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <SectionCard
        title="Medical history"
        description={
          existing
            ? `Last updated ${formatDateTime(existing.updatedAt)} by ${staffName(existing.updatedBy)}`
            : "Not yet recorded."
        }
        className="lg:col-span-3"
      >
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              if (run(() => save(ctx.patient.id, v), { success: "Medical history saved", setError: form.setError }))
                form.reset(v);
            })}
          >
            <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-5" disabled={!editable}>
              <legend className="mb-2 text-sm font-medium">Obstetric history</legend>
              <NumberField control={form.control} name="obstetric.gravida" label="Gravida" step="1" min={0} />
              <NumberField control={form.control} name="obstetric.para" label="Para" step="1" min={0} />
              <NumberField control={form.control} name="obstetric.living" label="Living" step="1" min={0} />
              <NumberField control={form.control} name="obstetric.miscarriages" label="Miscarriages" step="1" min={0} />
              <NumberField control={form.control} name="obstetric.ectopic" label="Ectopic" step="1" min={0} />
            </fieldset>
            <div className="grid gap-4 md:grid-cols-2">
              <TextareaField
                control={form.control}
                name="gynaecological"
                label="Gynaecological"
                rows={3}
                disabled={!editable}
              />
              <TextareaField control={form.control} name="surgical" label="Surgical" rows={3} disabled={!editable} />
              <TextareaField control={form.control} name="medical" label="Medical" rows={3} disabled={!editable} />
              <TextareaField
                control={form.control}
                name="drugAllergy"
                label="Drug history & allergies"
                rows={3}
                disabled={!editable}
              />
              <TextareaField
                control={form.control}
                name="family"
                label="Family history"
                rows={3}
                disabled={!editable}
              />
              <TextareaField
                control={form.control}
                name="semen"
                label="Semen / partner history"
                rows={3}
                disabled={!editable}
              />
            </div>
            {editable ? (
              <div className="flex justify-end">
                <Button type="submit" disabled={!form.formState.isDirty}>
                  Save history
                </Button>
              </div>
            ) : null}
          </form>
        </Form>
      </SectionCard>
      <SectionCard title="Past cycles summary" className="lg:col-span-2">
        {past.length === 0 ? (
          <EmptyState title="No previous cycles" />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Episode</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {past.map((c) => {
                  const ep = ctx.episodes.find((e) => e.id === c.episodeId);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">
                        {ep ? `${ep.ivfNo} · ${EPISODE_TYPE_LABELS[ep.type]}` : ""}
                      </TableCell>
                      <TableCell>
                        #{c.number} {c.kind}
                      </TableCell>
                      <TableCell>{formatDate(c.startDate)}</TableCell>
                      <TableCell>
                        <StatusChip status={c.outcome} label={OUTCOME_LABELS[c.outcome]} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
