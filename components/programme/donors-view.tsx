"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, ArrowRight, Check, Link2, Unlink } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HistoryTimeline } from "@/components/programme/history-timeline";
import { IdentityBlock } from "@/components/programme/identity-block";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip, humanize } from "@/components/shared/status-chip";
import { Toggle } from "@/components/patient/toggle-chip";
import { useLookups } from "@/hooks/use-lookups";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { EPISODE_TYPE_LABELS } from "@/lib/constants/clinical";
import type { Episode } from "@/lib/schemas/episode";
import { fullName } from "@/lib/schemas/person";
import { donorEligibility, donorSchema, type Donor } from "@/lib/schemas/programme";
import { useEpisodeStore } from "@/lib/stores/episode";
import { useCounsellingStore } from "@/lib/stores/counselling";
import { useProgrammeStore } from "@/lib/stores/programme";

type Screening = Donor["screening"];
const SCREEN_FIELDS: { key: keyof Screening; label: string; options: readonly string[] }[] = [
  { key: "hiv", label: "HIV", options: donorSchema.shape.screening.shape.hiv.options },
  { key: "hepB", label: "Hepatitis B", options: donorSchema.shape.screening.shape.hepB.options },
  { key: "hepC", label: "Hepatitis C", options: donorSchema.shape.screening.shape.hepC.options },
  { key: "syphilis", label: "Syphilis (VDRL)", options: donorSchema.shape.screening.shape.syphilis.options },
  { key: "karyotype", label: "Karyotype", options: donorSchema.shape.screening.shape.karyotype.options },
  {
    key: "geneticPanel",
    label: "Genetic carrier panel",
    options: donorSchema.shape.screening.shape.geneticPanel.options,
  },
];
const STATUSES = donorSchema.shape.status.options;

function ScreeningPanel({ donor, editable }: { donor: Donor; editable: boolean }) {
  const run = useRunAction();
  const update = useProgrammeStore((s) => s.updateDonorScreening);
  const [draft, setDraft] = useState<Screening>(donor.screening);
  const dirty = JSON.stringify(draft) !== JSON.stringify(donor.screening);
  const verdict = donorEligibility({ screening: draft });
  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Screening</p>
        <StatusChip status={verdict} label={`Rule engine: ${humanize(verdict)}`} />
      </div>
      <ul className="grid gap-2">
        {SCREEN_FIELDS.map((f) => (
          <li key={f.key} className="flex items-center justify-between gap-2 text-sm">
            <span>{f.label}</span>
            {editable ? (
              <Select value={draft[f.key]} onValueChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }) as Screening)}>
                <SelectTrigger size="sm" className="w-32" aria-label={f.label}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {f.options.map((o) => (
                    <SelectItem key={o} value={o}>
                      {humanize(o)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <StatusChip status={draft[f.key]} />
            )}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs">
        Eligible = all infections negative, karyotype normal and genetic panel clear. Any positive/abnormal result makes
        the donor ineligible.
      </p>
      {editable && dirty ? (
        <Button
          size="sm"
          className="w-fit"
          onClick={() => run(() => update(donor.id, draft), { success: "Screening updated" })}
        >
          Save screening
        </Button>
      ) : null}
    </div>
  );
}

function MatchWizard({
  open,
  onOpenChange,
  preset,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  preset?: Donor;
}) {
  const run = useRunAction();
  const episodes = useEpisodeStore((s) => s.episodes);
  const donors = useProgrammeStore((s) => s.donors);
  const match = useProgrammeStore((s) => s.matchDonor);
  const { person } = useLookups();
  const [step, setStep] = useState(0);
  const [episodeId, setEpisodeId] = useState<string>("");
  const [donorId, setDonorId] = useState<string>(preset?.id ?? "");
  const [sameBlood, setSameBlood] = useState(true);
  const [sameComplexion, setSameComplexion] = useState(false);
  const counselling = useCounsellingStore((s) => s.records);
  const recipients = episodes.filter(
    (e) =>
      e.status !== "closed" &&
      (e.type === "DONOR-OOCYTE" || e.type === "DONOR-SPERM" || e.type === "IVF" || e.type === "ICSI"),
  );
  const ep: Episode | undefined = episodes.find((e) => e.id === episodeId);
  const recipient = person(ep?.patientId);
  const kind = ep?.type === "DONOR-SPERM" ? "sperm" : "oocyte";
  const recipientComplexion = counselling
    .filter((c) => c.personId === ep?.patientId && c.complexion)
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.complexion;
  const candidates = donors.filter(
    (d) =>
      d.kind === kind &&
      d.status === "available" &&
      donorEligibility(d) === "eligible" &&
      (!sameBlood || !recipient?.bloodGroup || d.bloodGroup === recipient.bloodGroup) &&
      (!sameComplexion || !recipientComplexion || d.complexion === recipientComplexion),
  );
  const chosen = donors.find((d) => d.id === donorId);
  const reset = () => {
    setStep(0);
    setEpisodeId("");
    setDonorId(preset?.id ?? "");
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Match donor to recipient · step {step + 1} of 3</DialogTitle>
          <DialogDescription>
            {["Choose the recipient episode", "Filter by blood group and phenotype", "Confirm the match"][step]}
          </DialogDescription>
        </DialogHeader>
        {step === 0 ? (
          <RadioGroup
            value={episodeId}
            onValueChange={setEpisodeId}
            className="max-h-80 overflow-y-auto"
            aria-label="Recipient episode"
          >
            {recipients.map((e) => {
              const p = person(e.patientId);
              const has = donors.some((d) => d.matchedEpisodeId === e.id && d.status !== "retired");
              return (
                <Label key={e.id} className="hover:bg-accent flex items-center gap-3 rounded-md border p-2 font-normal">
                  <RadioGroupItem value={e.id} disabled={has} />
                  <span className="flex-1">
                    {p ? fullName(p) : "—"} · {e.ivfNo} · {EPISODE_TYPE_LABELS[e.type]}
                    <span className="text-muted-foreground block text-xs">
                      Blood group {p?.bloodGroup ?? "?"} · {e.diagnosis.join(", ")}
                    </span>
                  </span>
                  {has ? <Badge variant="secondary">Already matched</Badge> : null}
                </Label>
              );
            })}
          </RadioGroup>
        ) : null}
        {step === 1 ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              <Toggle pressed={sameBlood} onPressedChange={setSameBlood}>
                Same blood group ({recipient?.bloodGroup ?? "unknown"})
              </Toggle>
              <Toggle pressed={sameComplexion} onPressedChange={setSameComplexion}>
                Same complexion ({recipientComplexion ?? "not recorded"})
              </Toggle>
            </div>
            {candidates.length === 0 ? (
              <EmptyState title="No eligible donors match" description="Relax the blood-group filter or add donors." />
            ) : (
              <RadioGroup
                value={donorId}
                onValueChange={setDonorId}
                className="max-h-72 overflow-y-auto"
                aria-label="Donor"
              >
                {candidates.map((d) => (
                  <Label
                    key={d.id}
                    className="hover:bg-accent flex items-center gap-3 rounded-md border p-2 font-normal"
                  >
                    <RadioGroupItem value={d.id} />
                    <span>
                      <span className="font-medium">{d.code}</span> · age {d.age} · {d.bloodGroup}
                      <span className="text-muted-foreground block text-xs">
                        {d.height} m · {d.complexion} complexion · {d.eyeColour} eyes · {d.hairColour} hair
                        {d.amh ? ` · AMH ${d.amh}` : ""}
                      </span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            )}
          </div>
        ) : null}
        {step === 2 && chosen && ep ? (
          <p className="rounded-lg border p-3 text-sm">
            Match <strong>{chosen.code}</strong> ({chosen.kind} donor, {chosen.bloodGroup}) to{" "}
            <strong>{recipient ? fullName(recipient) : ""}</strong> · {ep.ivfNo}. Both records will be updated and the
            donor will no longer be available to other recipients.
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft aria-hidden="true" /> Back
          </Button>
          {step < 2 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={(step === 0 && !episodeId) || (step === 1 && !donorId)}
            >
              Next <ArrowRight aria-hidden="true" />
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (!chosen || !ep) return;
                const ok = run(
                  () => {
                    match(chosen.id, ep.id, ep.ivfNo);
                    return true;
                  },
                  { success: `${chosen.code} matched to ${ep.ivfNo}` },
                );
                if (ok) {
                  onOpenChange(false);
                  reset();
                }
              }}
            >
              <Check aria-hidden="true" /> Confirm match
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DonorsView() {
  const run = useRunAction();
  const canManage = usePermission("donors.manage");
  const canIdentity = usePermission("donors.identity");
  const donors = useProgrammeStore((s) => s.donors);
  const release = useProgrammeStore((s) => s.releaseDonor);
  const setStatus = useProgrammeStore((s) => s.setDonorStatus);
  const episodes = useEpisodeStore((s) => s.episodes);
  const { person } = useLookups();
  const [kind, setKind] = useState<"oocyte" | "sperm">("oocyte");
  const [status, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const selected = donors.find((d) => d.id === selectedId);
  const rows = useMemo(
    () => donors.filter((d) => d.kind === kind && (status === "all" || d.status === status)),
    [donors, kind, status],
  );
  const ivfNo = (id?: string) => episodes.find((e) => e.id === id)?.ivfNo ?? "—";

  const columns: ColumnDef<Donor, unknown>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => <span className="font-medium">{row.original.code}</span>,
    },
    ...(canIdentity
      ? [
          {
            id: "name",
            header: "Name",
            accessorFn: (d: Donor) => {
              const p = person(d.personId);
              return p ? fullName(p) : "—";
            },
          } as ColumnDef<Donor, unknown>,
        ]
      : []),
    { accessorKey: "age", header: "Age", meta: { align: "right" } },
    { accessorKey: "bloodGroup", header: "Blood group" },
    { accessorKey: "height", header: "Height (m)", meta: { align: "right" } },
    { accessorKey: "complexion", header: "Complexion" },
    { accessorKey: "eyeColour", header: "Eyes" },
    { accessorKey: "hairColour", header: "Hair" },
    ...(kind === "oocyte"
      ? [{ accessorKey: "amh", header: "AMH", meta: { align: "right" } } as ColumnDef<Donor, unknown>]
      : []),
    {
      id: "eligibility",
      header: "Eligibility",
      accessorFn: (d) => donorEligibility(d),
      cell: ({ row }) => <StatusChip status={donorEligibility(row.original)} />,
    },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusChip status={row.original.status} /> },
    { id: "recipient", header: "Recipient", accessorFn: (d) => ivfNo(d.matchedEpisodeId) },
  ];

  return (
    <>
      <PageHeader
        title="Donors"
        description="Anonymised oocyte and sperm donor register with screening, eligibility and matching."
        crumbs={[{ label: "Programmes" }, { label: "Donors" }]}
        actions={
          canManage ? (
            <Button onClick={() => setMatchOpen(true)}>
              <Link2 aria-hidden="true" /> Match donor to recipient
            </Button>
          ) : null
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={kind} onValueChange={(v) => setKind(v as "oocyte" | "sperm")}>
          <TabsList>
            <TabsTrigger value="oocyte">Oocyte donors ({donors.filter((d) => d.kind === "oocyte").length})</TabsTrigger>
            <TabsTrigger value="sperm">Sperm donors ({donors.filter((d) => d.kind === "sperm").length})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {["all", ...STATUSES].map((s) => (
            <Toggle key={s} pressed={status === s} onPressedChange={() => setStatusFilter(s)}>
              {humanize(s)} (
              {s === "all"
                ? donors.filter((d) => d.kind === kind).length
                : donors.filter((d) => d.kind === kind && d.status === s).length}
              )
            </Toggle>
          ))}
        </div>
      </div>
      <SectionCard
        title={`${rows.length} donor(s)`}
        description={canIdentity ? "Identity visible for your role." : "Identities are hidden for your role."}
      >
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search code, blood group, phenotype…"
          exportName={`${kind}-donors`}
          exportTitle={`${humanize(kind)} donors`}
          onRowClick={(d) => setSelectedId(d.id)}
        />
      </SectionCard>

      <Sheet open={selected !== undefined} onOpenChange={(o) => (!o ? setSelectedId(null) : undefined)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selected.code} <StatusChip status={selected.status} />
                </SheetTitle>
                <SheetDescription>
                  {humanize(selected.kind)} donor · age {selected.age} · {selected.bloodGroup}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 px-4 pb-6">
                <dl className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-sm">
                  {[
                    ["Height", `${selected.height} m`],
                    ["Complexion", selected.complexion],
                    ["Eyes", selected.eyeColour],
                    ["Hair", selected.hairColour],
                    ["Blood group", selected.bloodGroup],
                    ["AMH", selected.amh ?? "—"],
                  ].map(([k, v]) => (
                    <div key={String(k)}>
                      <dt className="text-muted-foreground text-xs">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <IdentityBlock person={person(selected.personId)} code={selected.code} entity="donor" />
                <ScreeningPanel
                  key={selected.id + JSON.stringify(selected.screening)}
                  donor={selected}
                  editable={canManage}
                />
                {selected.matchedEpisodeId ? (
                  <p className="text-sm">
                    Matched to <strong>{ivfNo(selected.matchedEpisodeId)}</strong>
                  </p>
                ) : null}
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    {selected.status === "available" ? (
                      <Button size="sm" onClick={() => setMatchOpen(true)}>
                        <Link2 aria-hidden="true" /> Match to recipient
                      </Button>
                    ) : null}
                    {selected.status === "matched" ? (
                      <ConfirmDialog
                        trigger={
                          <Button size="sm" variant="outline">
                            <Unlink aria-hidden="true" /> Release match
                          </Button>
                        }
                        title={`Release ${selected.code}?`}
                        description="The donor becomes available to other recipients."
                        confirmLabel="Release"
                        onConfirm={() => {
                          run(() => release(selected.id), { success: "Match released" });
                        }}
                      />
                    ) : null}
                    <Select
                      value={selected.status}
                      onValueChange={(v) =>
                        run(() => setStatus(selected.id, v as Donor["status"]), { success: `Status → ${humanize(v)}` })
                      }
                    >
                      <SelectTrigger size="sm" className="w-40" aria-label="Change status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {humanize(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div>
                  <p className="mb-2 text-sm font-semibold">Status timeline</p>
                  <HistoryTimeline items={selected.history} />
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
      <MatchWizard
        key={selected?.id ?? "none"}
        open={matchOpen}
        onOpenChange={setMatchOpen}
        preset={selected?.status === "available" ? selected : undefined}
      />
    </>
  );
}
