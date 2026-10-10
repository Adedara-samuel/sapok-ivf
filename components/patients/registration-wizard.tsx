"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, CircleAlert, UserCheck } from "lucide-react";
import { CheckboxField, SelectField, TextField, TextareaField, toOptions, DateField } from "@/components/forms/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { PageHeader } from "@/components/shared/page-header";
import { PhotoCapture } from "@/components/patient/photo-capture";
import { humanize } from "@/components/shared/status-chip";
import { useRunAction } from "@/hooks/use-run-action";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useZodForm } from "@/hooks/use-zod-form";
import { DIAGNOSES, EPISODE_TYPE_LABELS } from "@/lib/constants/clinical";
import { isoDate, optionalEmail, PayerCategory, phone } from "@/lib/schemas/common";
import { EpisodeType } from "@/lib/schemas/episode";
import { BLOOD_GROUPS, GENOTYPES, MARITAL_STATUSES, TITLES, fullName, type Person } from "@/lib/schemas/person";
import { useEpisodeStore } from "@/lib/stores/episode";
import { DuplicatePersonError, findDuplicatePerson, usePersonStore, type PersonInput } from "@/lib/stores/person";
import { useSessionStore } from "@/lib/stores/session";
import { useSettingsStore } from "@/lib/stores/settings";
import { useStaffStore } from "@/lib/stores/staff";
import { useWaitingStore } from "@/lib/stores/waiting";
import { ageParts, formatDate, todayIso } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

const name = z.string().trim().min(2, "At least 2 letters");
const dob = isoDate
  .refine((d) => d <= todayIso(), "Date of birth cannot be in the future")
  .refine((d) => {
    const a = ageParts(d).years;
    return a >= 18 && a <= 70;
  }, "Age must be between 18 and 70");

const regSchema = z
  .object({
    patient: z.object({
      title: z.enum(TITLES).optional(),
      firstName: name,
      lastName: name,
      otherNames: z.string().optional(),
      dob,
      maritalStatus: z.enum(MARITAL_STATUSES),
      bloodGroup: z.enum(BLOOD_GROUPS).optional(),
      genotype: z.enum(GENOTYPES).optional(),
      allergies: z.string().optional(),
      photoUrl: z.string().optional(),
      phone,
      email: optionalEmail,
    }),
    hasPartner: z.boolean(),
    partner: z.object({
      title: z.enum(TITLES).optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      dob: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      bloodGroup: z.enum(BLOOD_GROUPS).optional(),
      genotype: z.enum(GENOTYPES).optional(),
    }),
    address: z.string().min(5, "Enter a full address"),
    city: z.string().min(2, "Enter the city"),
    state: z.string().min(2, "Enter the state"),
    nextOfKin: z.object({
      name: z.string().min(2, "Enter the next of kin's name"),
      phone,
      relationship: z.string().min(2, "Enter the relationship"),
    }),
    payer: z.object({
      category: PayerCategory,
      sponsor: z.string().optional(),
      company: z.string().optional(),
      memberId: z.string().optional(),
    }),
    episodeType: EpisodeType,
    doctorId: z.string().min(1, "Choose the treating doctor"),
    diagnosis: z.array(z.string()).min(1, "Choose at least one diagnosis"),
    notes: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.hasPartner) {
      if (!v.partner.firstName || v.partner.firstName.trim().length < 2)
        ctx.addIssue({ code: "custom", path: ["partner", "firstName"], message: "Enter the partner's first name" });
      if (!v.partner.lastName || v.partner.lastName.trim().length < 2)
        ctx.addIssue({ code: "custom", path: ["partner", "lastName"], message: "Enter the partner's last name" });
      if (!v.partner.dob || !dob.safeParse(v.partner.dob).success)
        ctx.addIssue({ code: "custom", path: ["partner", "dob"], message: "Enter a valid date of birth (age 18–70)" });
      if (!v.partner.phone || !phone.safeParse(v.partner.phone).success)
        ctx.addIssue({ code: "custom", path: ["partner", "phone"], message: "Enter a valid Nigerian mobile number" });
      if (v.partner.email && !z.email().safeParse(v.partner.email).success)
        ctx.addIssue({ code: "custom", path: ["partner", "email"], message: "Enter a valid email address" });
    }
    if ((v.payer.category === "hmo" || v.payer.category === "referral") && !v.payer.sponsor)
      ctx.addIssue({
        code: "custom",
        path: ["payer", "sponsor"],
        message: v.payer.category === "hmo" ? "Enter the HMO name" : "Enter the referring doctor or facility",
      });
    if (v.payer.category === "corporate" && !v.payer.company)
      ctx.addIssue({ code: "custom", path: ["payer", "company"], message: "Enter the company name" });
  });
type RegInput = z.infer<typeof regSchema>;

const STEPS = [
  {
    key: "person",
    label: "Patient",
    fields: [
      "patient.title",
      "patient.firstName",
      "patient.lastName",
      "patient.otherNames",
      "patient.dob",
      "patient.maritalStatus",
      "patient.bloodGroup",
      "patient.genotype",
      "patient.allergies",
    ],
  },
  { key: "partner", label: "Partner", fields: ["hasPartner", "partner"] },
  {
    key: "contacts",
    label: "Contacts & next of kin",
    fields: ["patient.phone", "patient.email", "address", "city", "state", "nextOfKin"],
  },
  { key: "payer", label: "Payer & episode", fields: ["payer", "episodeType", "doctorId", "diagnosis"] },
  { key: "review", label: "Review", fields: [] },
] as const;

function AgeHint({ dobValue }: { dobValue?: string }) {
  if (!dobValue || !/^\d{4}-\d{2}-\d{2}$/.test(dobValue)) return null;
  const a = ageParts(dobValue);
  return (
    <p className="text-muted-foreground text-xs" aria-live="polite">
      Age: {a.years} years, {a.months} months, {a.days} days
    </p>
  );
}

export function RegistrationWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const run = useRunAction();
  const persons = usePersonStore((s) => s.persons);
  const register = usePersonStore((s) => s.register);
  const openEpisode = useEpisodeStore((s) => s.open);
  const addWaiting = useWaitingStore((s) => s.add);
  const staff = useStaffStore((s) => s.staff);
  const branchId = useSessionStore((s) => s.branchId);
  const ivfPrefix = useSettingsStore((s) => s.clinic.ivfPrefix);
  const [step, setStep] = useState(0);
  const [duplicates, setDuplicates] = useState<Person[]>([]);

  const form = useZodForm<RegInput>(regSchema, {
    patient: {
      title: "Mrs",
      firstName: "",
      lastName: "",
      dob: "",
      maritalStatus: "married",
      phone: "",
      email: "",
      allergies: "",
    },
    hasPartner: true,
    partner: { title: "Mr", firstName: "", lastName: "", dob: "", phone: "", email: "" },
    address: "",
    city: "Lagos",
    state: "Lagos",
    nextOfKin: { name: "", phone: "", relationship: "Husband" },
    payer: { category: "self-pay" },
    episodeType: "IVF",
    doctorId: "",
    diagnosis: [],
    notes: "",
  });
  useUnsavedGuard(form.formState.isDirty);
  const values = form.watch();
  const doctors = staff.filter((s) => s.role === "doctor" && s.active).map((s) => ({ value: s.id, label: s.name }));

  const next = async () => {
    const ok = await form.trigger(STEPS[step]?.fields as unknown as (keyof RegInput)[], { shouldFocus: true });
    if (!ok) return;
    if (step === 0 || step === 2) {
      const p = form.getValues("patient");
      if (p.phone && p.dob) {
        const dup = findDuplicatePerson(persons, p);
        if (dup) {
          setDuplicates([dup]);
          return;
        }
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = (v: RegInput, allowDuplicate = false) => {
    const common = { address: v.address, city: v.city, state: v.state, payer: v.payer, branchId };
    const patientInput: PersonInput = {
      ...common,
      title: v.patient.title,
      firstName: v.patient.firstName.trim(),
      lastName: v.patient.lastName.trim(),
      otherNames: v.patient.otherNames || undefined,
      sex: "F",
      dob: v.patient.dob,
      maritalStatus: v.patient.maritalStatus,
      phone: v.patient.phone,
      email: v.patient.email ?? "",
      nextOfKin: v.nextOfKin,
      bloodGroup: v.patient.bloodGroup,
      genotype: v.patient.genotype,
      allergies: (v.patient.allergies ?? "")
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      photoUrl: v.patient.photoUrl,
      roles: ["patient"],
    };
    const result = run(
      () => {
        const patient = register(patientInput, { allowDuplicate });
        let partnerId: string | undefined;
        if (v.hasPartner && v.partner.firstName && v.partner.lastName && v.partner.dob && v.partner.phone) {
          const partner = register(
            {
              ...common,
              title: v.partner.title,
              firstName: v.partner.firstName.trim(),
              lastName: v.partner.lastName.trim(),
              sex: "M",
              dob: v.partner.dob,
              maritalStatus: v.patient.maritalStatus,
              phone: v.partner.phone,
              email: v.partner.email ?? "",
              nextOfKin: { name: fullName(patient), phone: patient.phone, relationship: "Wife" },
              bloodGroup: v.partner.bloodGroup,
              genotype: v.partner.genotype,
              allergies: [],
              roles: ["partner"],
            },
            { allowDuplicate: true },
          );
          partnerId = partner.id;
        }
        const episode = openEpisode(
          {
            patientId: patient.id,
            partnerId,
            type: v.episodeType,
            doctorId: v.doctorId,
            diagnosis: v.diagnosis,
            branchId,
          },
          ivfPrefix,
        );
        if (params.get("from") === "waiting")
          addWaiting({
            personId: patient.id,
            episodeId: episode.id,
            doctorId: v.doctorId,
            purpose: "First consultation",
            branchId,
          });
        return { patient, episode };
      },
      { success: (r) => `Registered ${fullName(r.patient)} — ${r.patient.prn}, ${r.episode.ivfNo}` },
    );
    if (result) {
      form.reset(form.getValues());
      router.push(`/patients/${result.patient.id}`);
    }
  };

  const onSubmit = (v: RegInput) => {
    try {
      const dup = findDuplicatePerson(persons, v.patient);
      if (dup) throw new DuplicatePersonError(dup);
      submit(v);
    } catch (e) {
      if (e instanceof DuplicatePersonError) setDuplicates([e.match]);
    }
  };

  return (
    <>
      <PageHeader
        title="New registration"
        description="Register a couple and open their IVF episode. PRN and IVF numbers are assigned automatically."
        crumbs={[{ label: "Patients", href: "/patients" }, { label: "New registration" }]}
      />
      <ol className="mb-6 grid grid-cols-5 gap-2" aria-label="Registration steps">
        {STEPS.map((s, i) => (
          <li key={s.key} aria-current={i === step ? "step" : undefined}>
            <button
              type="button"
              onClick={() => (i < step ? setStep(i) : undefined)}
              disabled={i > step}
              className={cn(
                "flex w-full flex-col gap-1 rounded-lg border-t-4 px-1 pt-2 text-left text-xs",
                i < step ? "border-primary" : i === step ? "border-primary/60" : "border-border text-muted-foreground",
              )}
            >
              <span className="font-semibold">Step {i + 1}</span>
              <span className="truncate">{s.label}</span>
            </button>
          </li>
        ))}
      </ol>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <Card>
            <CardContent className="grid gap-5">
              {step === 0 ? (
                <>
                  <FormField
                    control={form.control}
                    name="patient.photoUrl"
                    render={({ field }) => <PhotoCapture value={field.value} onChange={field.onChange} />}
                  />
                  <div className="grid gap-4 md:grid-cols-4">
                    <SelectField
                      control={form.control}
                      name="patient.title"
                      label="Title"
                      options={toOptions(TITLES)}
                    />
                    <TextField control={form.control} name="patient.firstName" label="First name" required />
                    <TextField control={form.control} name="patient.lastName" label="Last name" required />
                    <TextField control={form.control} name="patient.otherNames" label="Other names" />
                    <div className="grid gap-1">
                      <DateField
                        control={form.control}
                        name="patient.dob"
                        label="Date of birth"
                        fromYear={1930}
                        toYear={new Date().getFullYear()}
                        max={todayIso()}
                        required
                      />
                      <AgeHint dobValue={values.patient.dob} />
                    </div>
                    <SelectField
                      control={form.control}
                      name="patient.maritalStatus"
                      label="Marital status"
                      options={toOptions(MARITAL_STATUSES, humanize)}
                      required
                    />
                    <SelectField
                      control={form.control}
                      name="patient.bloodGroup"
                      label="Blood group"
                      options={toOptions(BLOOD_GROUPS)}
                      allowEmpty
                    />
                    <SelectField
                      control={form.control}
                      name="patient.genotype"
                      label="Genotype"
                      options={toOptions(GENOTYPES)}
                      allowEmpty
                    />
                    <TextField
                      control={form.control}
                      name="patient.allergies"
                      label="Allergies"
                      placeholder="Comma separated, e.g. Penicillin"
                      className="md:col-span-4"
                    />
                  </div>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <CheckboxField
                    control={form.control}
                    name="hasPartner"
                    label="Register a male partner"
                    description="Untick for single women or donor-sperm treatment without a partner."
                  />
                  {values.hasPartner ? (
                    <div className="grid gap-4 md:grid-cols-4">
                      <SelectField
                        control={form.control}
                        name="partner.title"
                        label="Title"
                        options={toOptions(TITLES)}
                      />
                      <TextField control={form.control} name="partner.firstName" label="First name" required />
                      <TextField control={form.control} name="partner.lastName" label="Last name" required />
                      <div className="grid gap-1">
                        <DateField
                          control={form.control}
                          name="partner.dob"
                          label="Date of birth"
                          fromYear={1930}
                          toYear={new Date().getFullYear()}
                          max={todayIso()}
                          required
                        />
                        <AgeHint dobValue={values.partner.dob} />
                      </div>
                      <TextField
                        control={form.control}
                        name="partner.phone"
                        label="Mobile"
                        type="tel"
                        placeholder="08031234567"
                        required
                      />
                      <TextField control={form.control} name="partner.email" label="Email" type="email" />
                      <SelectField
                        control={form.control}
                        name="partner.bloodGroup"
                        label="Blood group"
                        options={toOptions(BLOOD_GROUPS)}
                        allowEmpty
                      />
                      <SelectField
                        control={form.control}
                        name="partner.genotype"
                        label="Genotype"
                        options={toOptions(GENOTYPES)}
                        allowEmpty
                      />
                    </div>
                  ) : null}
                </>
              ) : null}

              {step === 2 ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <TextField
                    control={form.control}
                    name="patient.phone"
                    label="Patient mobile"
                    type="tel"
                    placeholder="08031234567"
                    required
                    description="Nigerian mobile, 11 digits"
                  />
                  <TextField control={form.control} name="patient.email" label="Email" type="email" />
                  <div />
                  <TextField control={form.control} name="address" label="Address" required className="md:col-span-3" />
                  <TextField control={form.control} name="city" label="City" required />
                  <TextField control={form.control} name="state" label="State" required />
                  <div />
                  <TextField control={form.control} name="nextOfKin.name" label="Next of kin" required />
                  <TextField
                    control={form.control}
                    name="nextOfKin.phone"
                    label="Next of kin mobile"
                    type="tel"
                    required
                  />
                  <TextField control={form.control} name="nextOfKin.relationship" label="Relationship" required />
                </div>
              ) : null}

              {step === 3 ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <SelectField
                    control={form.control}
                    name="payer.category"
                    label="Payer category"
                    options={toOptions(PayerCategory.options, humanize)}
                    required
                  />
                  {values.payer.category === "hmo" || values.payer.category === "referral" ? (
                    <TextField
                      control={form.control}
                      name="payer.sponsor"
                      label={values.payer.category === "hmo" ? "HMO" : "Referred by"}
                      required
                    />
                  ) : null}
                  {values.payer.category === "corporate" ? (
                    <TextField control={form.control} name="payer.company" label="Company" required />
                  ) : null}
                  {values.payer.category !== "self-pay" ? (
                    <TextField control={form.control} name="payer.memberId" label="Member / staff ID" />
                  ) : null}
                  <SelectField
                    control={form.control}
                    name="episodeType"
                    label="Treatment type"
                    options={EpisodeType.options.map((t) => ({ value: t, label: EPISODE_TYPE_LABELS[t] }))}
                    required
                    className="md:col-start-1"
                  />
                  <SelectField
                    control={form.control}
                    name="doctorId"
                    label="Treating doctor"
                    options={doctors}
                    required
                  />
                  <FormField
                    control={form.control}
                    name="diagnosis"
                    render={({ field }) => (
                      <FormItem className="md:col-span-3">
                        <FormLabel>Diagnosis</FormLabel>
                        <FormControl>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="group" aria-label="Diagnosis">
                            {DIAGNOSES.map((d) => (
                              <Label
                                key={d}
                                className="hover:bg-accent flex items-center gap-2 rounded-md border p-2 font-normal"
                              >
                                <Checkbox
                                  checked={field.value.includes(d)}
                                  onCheckedChange={(c) =>
                                    field.onChange(
                                      c === true ? [...field.value, d] : field.value.filter((x) => x !== d),
                                    )
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
                  <TextareaField
                    control={form.control}
                    name="notes"
                    label="Front-desk remarks"
                    rows={2}
                    className="md:col-span-3"
                  />
                </div>
              ) : null}

              {step === 4 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <dl className="grid gap-1 rounded-lg border p-4 text-sm">
                    <dt className="text-muted-foreground text-xs font-semibold uppercase">Patient</dt>
                    <dd className="font-medium">
                      {values.patient.title} {values.patient.firstName} {values.patient.lastName}
                    </dd>
                    <dd>
                      DOB {formatDate(values.patient.dob)} ·{" "}
                      {values.patient.dob ? `${ageParts(values.patient.dob).years} years` : ""}
                    </dd>
                    <dd>
                      {values.patient.phone} · {values.patient.email || "no email"}
                    </dd>
                    <dd>
                      {values.address}, {values.city}, {values.state}
                    </dd>
                    <dd>
                      Next of kin: {values.nextOfKin.name} ({values.nextOfKin.relationship}) {values.nextOfKin.phone}
                    </dd>
                  </dl>
                  <dl className="grid gap-1 rounded-lg border p-4 text-sm">
                    <dt className="text-muted-foreground text-xs font-semibold uppercase">Partner & episode</dt>
                    <dd className="font-medium">
                      {values.hasPartner
                        ? `${values.partner.title ?? ""} ${values.partner.firstName} ${values.partner.lastName}`
                        : "No partner registered"}
                    </dd>
                    <dd>
                      {EPISODE_TYPE_LABELS[values.episodeType]} with{" "}
                      {doctors.find((d) => d.value === values.doctorId)?.label ?? "—"}
                    </dd>
                    <dd className="flex flex-wrap gap-1">
                      {values.diagnosis.map((d) => (
                        <Badge key={d} variant="secondary">
                          {d}
                        </Badge>
                      ))}
                    </dd>
                    <dd>
                      Payer: {humanize(values.payer.category)} {values.payer.sponsor ?? values.payer.company ?? ""}
                    </dd>
                  </dl>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="mt-4 flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeft aria-hidden="true" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button key="continue" type="button" onClick={() => void next()}>
                Continue <ArrowRight aria-hidden="true" />
              </Button>
            ) : (
              <Button key="submit" type="submit">
                <Check aria-hidden="true" /> Register and open file
              </Button>
            )}
          </div>
        </form>
      </Form>

      <Dialog open={duplicates.length > 0} onOpenChange={(o) => (!o ? setDuplicates([]) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleAlert className="text-warning size-5" aria-hidden="true" /> Possible duplicate patient
            </DialogTitle>
            <DialogDescription>
              A person with the same name, date of birth and phone number is already registered.
            </DialogDescription>
          </DialogHeader>
          {duplicates.map((d) => (
            <div key={d.id} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{fullName(d, true)}</p>
              <p className="text-muted-foreground">
                {d.prn} · DOB {formatDate(d.dob)} · {d.phone}
              </p>
            </div>
          ))}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDuplicates([]);
                if (step === STEPS.length - 1) submit(form.getValues(), true);
                else setStep((s) => s + 1);
              }}
            >
              Continue as new record
            </Button>
            <Button
              onClick={() => {
                const d = duplicates[0];
                setDuplicates([]);
                form.reset(form.getValues());
                if (d) router.push(`/patients/${d.id}`);
              }}
            >
              <UserCheck aria-hidden="true" /> Open existing file (merge)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
