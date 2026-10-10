"use client";

import { Combobox } from "@/components/shared/combobox";
import { useFieldArray } from "react-hook-form";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { NumberField, TextField, TextareaField, DateField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { INJECTION_DRUGS } from "@/lib/constants/clinical";
import { isoDate } from "@/lib/schemas/common";
import { useClinicalStore } from "@/lib/stores/clinical";
import { todayIso, shiftDate } from "@/lib/utils/dates";

const follicleText = z
  .string()
  .regex(/^\s*(\d+(\.\d+)?\s*(,\s*\d+(\.\d+)?\s*)*)?$/, "Enter sizes in mm separated by commas, e.g. 14, 12, 11")
  .refine(
    (v) => v.trim() === "" || v.split(",").every((x) => Number(x) > 0 && Number(x) <= 40),
    "Each follicle must be 1–40 mm",
  );

const stimForm = z.object({
  date: isoDate,
  scanDay: z.string().trim().min(1, "Enter the scan day, e.g. D10 follicular scan"),
  injections: z.array(z.object({ drug: z.string().min(1, "Drug"), dose: z.string().min(1, "Dose") })),
  endometriumMm: z.number().positive().max(30).optional(),
  right: follicleText,
  left: follicleText,
  e2: z.number().nonnegative().optional(),
  lh: z.number().nonnegative().optional(),
  progesterone: z.number().nonnegative().optional(),
  remark: z.string().optional(),
  nextScan: isoDate.optional(),
});
type StimForm = z.infer<typeof stimForm>;

const parseList = (v: string): number[] =>
  v.trim() === ""
    ? []
    : v
        .split(",")
        .map((x) => Number(x.trim()))
        .sort((a, b) => b - a);

/** Posts a stimulation monitoring / prescription entry (injections, dose, scan day, findings, remark). */
export function StimulationForm({
  cycleId,
  defaultScanDay,
  defaultInjections,
  onDone,
}: {
  cycleId: string;
  defaultScanDay?: string;
  defaultInjections?: { drug: string; dose: string }[];
  onDone?: () => void;
}) {
  const run = useRunAction();
  const add = useClinicalStore((s) => s.addStimulation);
  const today = todayIso();
  const form = useZodForm<StimForm>(stimForm, {
    date: today,
    scanDay: defaultScanDay ?? "",
    injections: defaultInjections && defaultInjections.length > 0 ? defaultInjections : [{ drug: "", dose: "" }],
    right: "",
    left: "",
    remark: "",
    nextScan: shiftDate(today, 2),
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "injections" });

  return (
    <Form {...form}>
      <form
        className="grid gap-4"
        noValidate
        onSubmit={form.handleSubmit((v) => {
          const res = run(
            () =>
              add(cycleId, {
                date: v.date,
                scanDay: v.scanDay,
                injections: v.injections.filter((i) => i.drug && i.dose),
                endometriumMm: v.endometriumMm,
                follicles: { right: parseList(v.right), left: parseList(v.left) },
                e2: v.e2,
                lh: v.lh,
                progesterone: v.progesterone,
                remark: v.remark || undefined,
                nextScan: v.nextScan,
              }),
            { success: "Monitoring entry posted", setError: form.setError },
          );
          if (res) onDone?.();
        })}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <DateField control={form.control} name="date" label="Date" required />
          <TextField
            control={form.control}
            name="scanDay"
            label="Scan day"
            placeholder="D10 follicular scan"
            required
          />
          <DateField control={form.control} name="nextScan" label="Next scan" />
        </div>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Injections & dose</legend>
          {fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-[1fr_10rem_auto] items-start gap-2">
              <FormField
                control={form.control}
                name={`injections.${i}.drug`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Drug {i + 1}</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value}
                        onChange={field.onChange}
                        options={INJECTION_DRUGS}
                        placeholder="Choose drug"
                        aria-label={`Drug ${i + 1}`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`injections.${i}.dose`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Dose {i + 1}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Dose, e.g. 225 IU" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(i)}
                aria-label={`Remove injection ${i + 1}`}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => append({ drug: "", dose: "" })}
          >
            <Plus aria-hidden="true" /> Add injection
          </Button>
        </fieldset>
        <div className="grid gap-4 md:grid-cols-3">
          <TextField control={form.control} name="right" label="Right ovary follicles (mm)" placeholder="14, 12, 11" />
          <TextField control={form.control} name="left" label="Left ovary follicles (mm)" placeholder="15, 13, 9" />
          <NumberField control={form.control} name="endometriumMm" label="Endometrium" suffix="mm" step="0.1" />
          <NumberField control={form.control} name="e2" label="Estradiol (E2)" suffix="pg/mL" />
          <NumberField control={form.control} name="lh" label="LH" suffix="IU/L" step="0.1" />
          <NumberField control={form.control} name="progesterone" label="Progesterone" suffix="ng/mL" step="0.1" />
        </div>
        <TextareaField
          control={form.control}
          name="remark"
          label="Findings / remark"
          rows={2}
          placeholder="e.g. Good response; for D10 follicular scan"
        />
        <div className="flex justify-end">
          <Button type="submit">Post entry</Button>
        </div>
      </form>
    </Form>
  );
}
