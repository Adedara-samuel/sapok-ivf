"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";
import { Eye, Plus } from "lucide-react";
import { NumberField, SelectField, TextField, TextareaField, toOptions, DateField } from "@/components/forms/fields";
import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConsentPrint } from "@/components/consent/consent-print";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PersonPicker } from "@/components/shared/person-picker";
import { SectionCard } from "@/components/shared/section-card";
import { humanize } from "@/components/shared/status-chip";
import { useLookups } from "@/hooks/use-lookups";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { isoDate, phone } from "@/lib/schemas/common";
import { ClientType, COUNSELLING_CHECKLISTS, type Counselling } from "@/lib/schemas/counselling";
import { BLOOD_GROUPS, fullName } from "@/lib/schemas/person";
import { COMPLEXIONS } from "@/lib/constants/clinical";
import { useCounsellingStore } from "@/lib/stores/counselling";
import { useEpisodeStore } from "@/lib/stores/episode";
import { useSettingsStore } from "@/lib/stores/settings";
import { formatDate, todayIso } from "@/lib/utils/dates";

const optPhone = phone.optional().or(z.literal(""));
const counselForm = z.object({
  personId: z.string().min(1, "Choose the client"),
  date: isoDate,
  complexion: z.string().optional(),
  afc: z.number().int().nonnegative().optional(),
  lmp: isoDate.optional().or(z.literal("")),
  bloodGroup: z.string().optional(),
  wifePhone: optPhone,
  husbandPhone: optPhone,
  email: z.email("Enter a valid email address").optional().or(z.literal("")),
  referral: z.string().optional(),
  children: z.number({ error: "Enter number of children (0 if none)" }).int().nonnegative(),
  clientType: ClientType,
  checklist: z.array(z.string()),
  notes: z.string().trim().min(3, "Write at least 3 characters"),
});
type CounselForm = z.infer<typeof counselForm>;

interface Row extends Counselling {
  client: string;
  prn: string;
  partner: string;
  counsellor: string;
}

export function CounsellingView() {
  const run = useRunAction();
  const canManage = usePermission("counselling.manage");
  const records = useCounsellingStore((s) => s.records);
  const add = useCounsellingStore((s) => s.add);
  const episodes = useEpisodeStore((s) => s.episodes);
  const consentTemplates = useSettingsStore((s) => s.consentTemplates);
  const { person, personName, staffName } = useLookups();
  const [scope, setScope] = useState<"today" | "all">("today");
  const [type, setType] = useState("all");
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Row | null>(null);
  const today = todayIso();
  const form = useZodForm<CounselForm>(counselForm, {
    date: today,
    children: 0,
    clientType: "new",
    checklist: [],
    notes: "",
    wifePhone: "",
    husbandPhone: "",
    email: "",
    lmp: "",
  });
  const clientType = form.watch("clientType");

  const rows = useMemo<Row[]>(
    () =>
      records
        .filter((r) => (scope === "all" || r.date === today) && (type === "all" || r.clientType === type))
        .map((r) => ({
          ...r,
          client: personName(r.personId),
          prn: person(r.personId)?.prn ?? "—",
          partner: personName(r.partnerId),
          counsellor: staffName(r.counsellorId),
        }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [records, scope, type, today, person, personName, staffName],
  );

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "date", header: "Date", cell: ({ row }) => formatDate(row.original.date) },
    {
      accessorKey: "client",
      header: "Client",
      cell: ({ row }) => <span className="font-medium">{row.original.client}</span>,
    },
    { accessorKey: "partner", header: "Partner" },
    {
      accessorKey: "clientType",
      header: "Client type",
      cell: ({ row }) => <Badge variant="secondary">{humanize(row.original.clientType)}</Badge>,
    },
    { accessorKey: "complexion", header: "Complexion" },
    { accessorKey: "afc", header: "AFC", meta: { align: "right" } },
    { accessorKey: "lmp", header: "LMP", cell: ({ row }) => formatDate(row.original.lmp) },
    { accessorKey: "bloodGroup", header: "Blood group" },
    { accessorKey: "wifePhone", header: "Wife phone" },
    { accessorKey: "husbandPhone", header: "Husband phone" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "referral", header: "Referral" },
    { accessorKey: "children", header: "Children", meta: { align: "right" } },
    { accessorKey: "counsellor", header: "Counsellor" },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={() => setViewing(row.original)}>
          <Eye aria-hidden="true" /> View
        </Button>
      ),
    },
  ];

  const viewingPerson = viewing ? person(viewing.personId) : undefined;
  const viewingEpisode = viewing ? episodes.find((e) => e.patientId === viewing.personId) : undefined;
  const ivfTemplate = consentTemplates.find(
    (t) =>
      t.id ===
      (viewing?.clientType === "donor-recipient"
        ? "donor"
        : viewing?.clientType === "surrogacy-intending"
          ? "surrogacy"
          : "ivf"),
  );

  return (
    <>
      <PageHeader
        title="Counselling"
        description="Counselling sessions and checklists for new, returning, donor-recipient and surrogacy clients."
        crumbs={[{ label: "Programmes" }, { label: "Counselling" }]}
        actions={
          canManage ? (
            <Button onClick={() => setOpen(true)}>
              <Plus aria-hidden="true" /> Add counselling note
            </Button>
          ) : null
        }
      />
      <SectionCard title={scope === "today" ? `Today · ${formatDate(today)}` : "All counselling records"}>
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search client, phone, referral…"
          exportName="counselling"
          exportTitle="Counselling records"
          initialHidden={{ email: false, husbandPhone: false, complexion: false }}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={scope} onValueChange={(v) => setScope(v as "today" | "all")}>
                <TabsList>
                  <TabsTrigger value="today">Today</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
              </Tabs>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger size="sm" className="w-48" aria-label="Client type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All client types</SelectItem>
                  {ClientType.options.map((t) => (
                    <SelectItem key={t} value={t}>
                      {humanize(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
          empty={
            <EmptyState
              title={scope === "today" ? "No data found for today" : "No counselling records match"}
              description={
                scope === "today" ? "No counselling session has been recorded today." : "Try another client type."
              }
              action={
                canManage ? (
                  <Button onClick={() => setOpen(true)}>
                    <Plus aria-hidden="true" /> Add counselling note
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setScope("all")}>
                    View all records
                  </Button>
                )
              }
            />
          }
        />
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add counselling note</DialogTitle>
            <DialogDescription>
              Choosing the client fills in phones, blood group and partner from the record.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              noValidate
              className="grid gap-4"
              onSubmit={form.handleSubmit((v) => {
                const ep = episodes.find((e) => e.patientId === v.personId);
                const res = run(
                  () =>
                    add({
                      ...v,
                      partnerId: ep?.partnerId,
                      lmp: v.lmp || undefined,
                      email: v.email || undefined,
                      wifePhone: v.wifePhone || undefined,
                      husbandPhone: v.husbandPhone || undefined,
                      complexion: v.complexion || undefined,
                      bloodGroup: v.bloodGroup || undefined,
                      referral: v.referral || undefined,
                    }),
                  { success: "Counselling note saved", setError: form.setError },
                );
                if (res) {
                  form.reset();
                  setOpen(false);
                  setScope(v.date === today ? "today" : "all");
                }
              })}
            >
              <FormField
                control={form.control}
                name="personId"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Client (female partner)</FormLabel>
                    <FormControl>
                      <PersonPicker
                        value={field.value}
                        invalid={Boolean(fieldState.error)}
                        onChange={(p) => {
                          field.onChange(p.id);
                          const ep = episodes.find((e) => e.patientId === p.id);
                          const partner = ep?.partnerId ? person(ep.partnerId) : undefined;
                          form.setValue("wifePhone", p.phone);
                          form.setValue("husbandPhone", partner?.phone ?? "");
                          form.setValue("email", p.email ?? "");
                          form.setValue("bloodGroup", p.bloodGroup);
                          form.setValue(
                            "clientType",
                            ep
                              ? ep.type === "DONOR-OOCYTE" || ep.type === "DONOR-SPERM"
                                ? "donor-recipient"
                                : ep.type === "SURROGACY"
                                  ? "surrogacy-intending"
                                  : "returning"
                              : "new",
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <DateField control={form.control} name="date" label="Date" required />
                <SelectField
                  control={form.control}
                  name="clientType"
                  label="Client type"
                  options={toOptions(ClientType.options, humanize)}
                  required
                />
                <SelectField
                  control={form.control}
                  name="complexion"
                  label="Complexion"
                  options={toOptions(COMPLEXIONS)}
                  allowEmpty
                />
                <NumberField control={form.control} name="afc" label="AFC" step="1" min={0} />
                <DateField control={form.control} name="lmp" label="LMP" />
                <SelectField
                  control={form.control}
                  name="bloodGroup"
                  label="Blood group"
                  options={toOptions(BLOOD_GROUPS)}
                  allowEmpty
                />
                <TextField control={form.control} name="wifePhone" label="Wife phone" type="tel" />
                <TextField control={form.control} name="husbandPhone" label="Husband phone" type="tel" />
                <TextField control={form.control} name="email" label="Email" type="email" />
                <TextField control={form.control} name="referral" label="Referral" placeholder="Self, doctor, HMO…" />
                <NumberField control={form.control} name="children" label="Children" step="1" min={0} required />
              </div>
              <FormField
                control={form.control}
                name="checklist"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Checklist — {humanize(clientType)}</FormLabel>
                    <FormControl>
                      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Counselling checklist">
                        {COUNSELLING_CHECKLISTS[clientType].map((item) => (
                          <Label
                            key={item}
                            className="hover:bg-accent flex items-center gap-2 rounded-md border p-2 font-normal"
                          >
                            <Checkbox
                              checked={field.value.includes(item)}
                              onCheckedChange={(c) =>
                                field.onChange(
                                  c === true ? [...field.value, item] : field.value.filter((x) => x !== item),
                                )
                              }
                            />
                            {item}
                          </Label>
                        ))}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <TextareaField control={form.control} name="notes" label="Counselling notes" rows={4} required />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save note</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Sheet open={viewing !== null} onOpenChange={(o) => (!o ? setViewing(null) : undefined)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{viewing?.client}</SheetTitle>
            <SheetDescription>
              {viewing ? `${formatDate(viewing.date)} · ${humanize(viewing.clientType)} · ${viewing.counsellor}` : ""}
            </SheetDescription>
          </SheetHeader>
          {viewing ? (
            <div className="grid gap-4 px-4 pb-6 text-sm">
              <dl className="grid grid-cols-2 gap-2">
                {[
                  ["PRN", viewing.prn],
                  ["Partner", viewing.partner],
                  ["Complexion", viewing.complexion ?? "—"],
                  ["AFC", viewing.afc ?? "—"],
                  ["LMP", formatDate(viewing.lmp)],
                  ["Blood group", viewing.bloodGroup ?? "—"],
                  ["Wife phone", viewing.wifePhone ?? "—"],
                  ["Husband phone", viewing.husbandPhone ?? "—"],
                  ["Email", viewing.email ?? "—"],
                  ["Referral", viewing.referral ?? "—"],
                  ["Children", viewing.children],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <dt className="text-muted-foreground text-xs">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              {viewing.checklist.length > 0 ? (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs">Checklist completed</p>
                  <ul className="list-inside list-disc">
                    {viewing.checklist.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="rounded-lg border p-3 whitespace-pre-line">{viewing.notes}</p>
              {viewingPerson && ivfTemplate ? (
                <ConsentPrint
                  template={ivfTemplate}
                  identifiers={[
                    { label: "Client", value: fullName(viewingPerson) },
                    { label: "PRN", value: viewingPerson.prn },
                    { label: "IVF no", value: viewingEpisode?.ivfNo ?? "—" },
                    { label: "Partner", value: viewing.partner },
                  ]}
                  branchId={viewingPerson.branchId}
                  label={`Print ${ivfTemplate.title.toLowerCase()}`}
                />
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
