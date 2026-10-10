"use client";

import { z } from "zod";
import { SelectField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { PersonPicker } from "@/components/shared/person-picker";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { DIAGNOSES, EPISODE_TYPE_LABELS } from "@/lib/constants/clinical";
import { EpisodeType } from "@/lib/schemas/episode";
import type { Person } from "@/lib/schemas/person";
import { useEpisodeStore } from "@/lib/stores/episode";
import { useSettingsStore } from "@/lib/stores/settings";
import { useStaffStore } from "@/lib/stores/staff";

const openForm = z.object({
  type: EpisodeType,
  doctorId: z.string().min(1, "Choose the treating doctor"),
  partnerId: z.string().optional(),
  diagnosis: z.array(z.string()).min(1, "Choose at least one diagnosis"),
});
type OpenForm = z.infer<typeof openForm>;

export function OpenEpisodeDialog({
  patient,
  defaultPartnerId,
  open,
  onOpenChange,
}: {
  patient: Person;
  defaultPartnerId?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const run = useRunAction();
  const openEpisode = useEpisodeStore((s) => s.open);
  const staff = useStaffStore((s) => s.staff);
  const ivfPrefix = useSettingsStore((s) => s.clinic.ivfPrefix);
  const form = useZodForm<OpenForm>(openForm, {
    type: "IVF",
    doctorId: "",
    partnerId: defaultPartnerId,
    diagnosis: [],
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Open treatment episode</DialogTitle>
          <DialogDescription>Assigns the next IVF number and makes the clinical tabs available.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              if (
                run(
                  () =>
                    openEpisode(
                      {
                        patientId: patient.id,
                        partnerId: v.partnerId,
                        type: v.type,
                        doctorId: v.doctorId,
                        diagnosis: v.diagnosis,
                        branchId: patient.branchId,
                      },
                      ivfPrefix,
                    ),
                  { success: (e) => `Episode ${e.ivfNo} opened`, setError: form.setError },
                )
              )
                onOpenChange(false);
            })}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="type"
                label="Treatment type"
                required
                options={EpisodeType.options.map((t) => ({ value: t, label: EPISODE_TYPE_LABELS[t] }))}
              />
              <SelectField
                control={form.control}
                name="doctorId"
                label="Treating doctor"
                required
                options={staff
                  .filter((s) => s.role === "doctor" && s.active)
                  .map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
            <FormField
              control={form.control}
              name="partnerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Partner</FormLabel>
                  <FormControl>
                    <PersonPicker
                      value={field.value}
                      roles={["partner"]}
                      onChange={(p) => field.onChange(p.id)}
                      placeholder="Search registered partners (optional)"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="diagnosis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diagnosis</FormLabel>
                  <FormControl>
                    <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Diagnosis">
                      {DIAGNOSES.map((d) => (
                        <Label
                          key={d}
                          className="hover:bg-accent flex items-center gap-2 rounded-md border p-2 font-normal"
                        >
                          <Checkbox
                            checked={field.value.includes(d)}
                            onCheckedChange={(c) =>
                              field.onChange(c === true ? [...field.value, d] : field.value.filter((x) => x !== d))
                            }
                          />
                          {d}
                        </Label>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Open episode</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
