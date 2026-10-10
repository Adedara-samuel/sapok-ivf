"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, FileSignature, Link2 } from "lucide-react";
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
import { HistoryTimeline } from "@/components/programme/history-timeline";
import { IdentityBlock } from "@/components/programme/identity-block";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip, humanize } from "@/components/shared/status-chip";
import { Toggle } from "@/components/patient/toggle-chip";
import { useLookups } from "@/hooks/use-lookups";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { fullName } from "@/lib/schemas/person";
import { surrogateEligibility, surrogateSchema, type Surrogate } from "@/lib/schemas/programme";
import { useEpisodeStore } from "@/lib/stores/episode";
import { useProgrammeStore } from "@/lib/stores/programme";
import { formatDate } from "@/lib/utils/dates";

type Screening = Surrogate["screening"];
const SCREEN_FIELDS: { key: keyof Screening; label: string; options: readonly string[] }[] = [
  { key: "medical", label: "Medical", options: surrogateSchema.shape.screening.shape.medical.options },
  {
    key: "psychological",
    label: "Psychological",
    options: surrogateSchema.shape.screening.shape.psychological.options,
  },
  {
    key: "uterineEval",
    label: "Uterine evaluation",
    options: surrogateSchema.shape.screening.shape.uterineEval.options,
  },
  { key: "legal", label: "Legal agreement", options: surrogateSchema.shape.screening.shape.legal.options },
];
const STATUSES = surrogateSchema.shape.status.options;

function ScreeningEditor({ s, editable }: { s: Surrogate; editable: boolean }) {
  const run = useRunAction();
  const update = useProgrammeStore((st) => st.updateSurrogateScreening);
  const [draft, setDraft] = useState<Screening>(s.screening);
  const dirty = JSON.stringify(draft) !== JSON.stringify(s.screening);
  const verdict = surrogateEligibility({ screening: draft });
  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Screening & legal</p>
        <StatusChip status={verdict} label={`Rule engine: ${humanize(verdict)}`} />
      </div>
      <ul className="grid gap-2">
        {SCREEN_FIELDS.map((f) => (
          <li key={f.key} className="flex items-center justify-between text-sm">
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
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <FileSignature className="size-3.5" aria-hidden="true" /> Legal agreement{" "}
        {s.legalSignedAt ? `signed ${formatDate(s.legalSignedAt)}` : "not yet signed"}. Matching requires all checks
        cleared and the agreement signed.
      </p>
      {editable && dirty ? (
        <Button
          size="sm"
          className="w-fit"
          onClick={() => run(() => update(s.id, draft), { success: "Screening updated" })}
        >
          Save screening
        </Button>
      ) : null}
    </div>
  );
}

export function SurrogatesView() {
  const run = useRunAction();
  const canManage = usePermission("surrogates.manage");
  const canIdentity = usePermission("donors.identity");
  const surrogates = useProgrammeStore((s) => s.surrogates);
  const matchSurrogate = useProgrammeStore((s) => s.matchSurrogate);
  const setStatus = useProgrammeStore((s) => s.setSurrogateStatus);
  const episodes = useEpisodeStore((s) => s.episodes);
  const { person } = useLookups();
  const [status, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [episodeId, setEpisodeId] = useState("");
  const selected = surrogates.find((s) => s.id === selectedId);
  const rows = useMemo(() => surrogates.filter((s) => status === "all" || s.status === status), [surrogates, status]);
  const ivfNo = (id?: string) => episodes.find((e) => e.id === id)?.ivfNo ?? "—";
  const intending = episodes.filter(
    (e) =>
      e.type === "SURROGACY" &&
      e.status !== "closed" &&
      !surrogates.some((s) => s.matchedEpisodeId === e.id && s.status !== "retired" && s.status !== "delivered"),
  );

  const columns: ColumnDef<Surrogate, unknown>[] = [
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
            accessorFn: (s: Surrogate) => {
              const p = person(s.personId);
              return p ? fullName(p) : "—";
            },
          } as ColumnDef<Surrogate, unknown>,
        ]
      : []),
    { accessorKey: "age", header: "Age", meta: { align: "right" } },
    { accessorKey: "parity", header: "Parity", meta: { align: "right" } },
    ...SCREEN_FIELDS.map(
      (f) =>
        ({
          id: f.key,
          header: f.label,
          accessorFn: (s: Surrogate) => s.screening[f.key],
          cell: ({ row }: { row: { original: Surrogate } }) => <StatusChip status={row.original.screening[f.key]} />,
        }) as ColumnDef<Surrogate, unknown>,
    ),
    {
      id: "eligibility",
      header: "Eligibility",
      accessorFn: (s) => surrogateEligibility(s),
      cell: ({ row }) => <StatusChip status={surrogateEligibility(row.original)} />,
    },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusChip status={row.original.status} /> },
    { id: "couple", header: "Intending parents", accessorFn: (s) => ivfNo(s.matchedEpisodeId) },
  ];

  return (
    <>
      <PageHeader
        title="Surrogates"
        description="Gestational carrier register: screening, legal agreements, matching and pregnancy tracking."
        crumbs={[{ label: "Programmes" }, { label: "Surrogates" }]}
      />
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
        {["all", ...STATUSES].map((s) => (
          <Toggle key={s} pressed={status === s} onPressedChange={() => setStatusFilter(s)}>
            {humanize(s)} ({s === "all" ? surrogates.length : surrogates.filter((x) => x.status === s).length})
          </Toggle>
        ))}
      </div>
      <SectionCard title={`${rows.length} surrogate(s)`}>
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search code…"
          exportName="surrogates"
          exportTitle="Surrogates"
          onRowClick={(s) => setSelectedId(s.id)}
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
                  Age {selected.age} · parity {selected.parity}
                  {selected.matchedEpisodeId ? ` · intending parents ${ivfNo(selected.matchedEpisodeId)}` : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 px-4 pb-6">
                <IdentityBlock person={person(selected.personId)} code={selected.code} entity="surrogate" />
                <ScreeningEditor
                  key={selected.id + JSON.stringify(selected.screening)}
                  s={selected}
                  editable={canManage}
                />
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    {selected.status === "approved" ? (
                      <Button size="sm" onClick={() => setMatchOpen(true)}>
                        <Link2 aria-hidden="true" /> Match to intending parents
                      </Button>
                    ) : null}
                    <Select
                      value={selected.status}
                      onValueChange={(v) =>
                        run(
                          () => {
                            setStatus(selected.id, v as Surrogate["status"]);
                            return true;
                          },
                          { success: `Status → ${humanize(v)}` },
                        )
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

      <Dialog open={matchOpen} onOpenChange={setMatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Match {selected?.code} to intending parents</DialogTitle>
            <DialogDescription>Only open surrogacy episodes without a current surrogate are listed.</DialogDescription>
          </DialogHeader>
          {intending.length === 0 ? (
            <EmptyState title="No surrogacy episodes awaiting a match" />
          ) : (
            <RadioGroup value={episodeId} onValueChange={setEpisodeId} aria-label="Intending parents">
              {intending.map((e) => {
                const p = person(e.patientId);
                return (
                  <Label
                    key={e.id}
                    className="hover:bg-accent flex items-center gap-3 rounded-md border p-2 font-normal"
                  >
                    <RadioGroupItem value={e.id} />
                    {p ? fullName(p) : "—"} · {e.ivfNo} · {e.diagnosis.join(", ")}
                  </Label>
                );
              })}
            </RadioGroup>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!episodeId || !selected}
              onClick={() => {
                const ep = episodes.find((e) => e.id === episodeId);
                if (!selected || !ep) return;
                const ok = run(
                  () => {
                    matchSurrogate(selected.id, ep.id, ep.ivfNo);
                    return true;
                  },
                  { success: `${selected.code} matched to ${ep.ivfNo}` },
                );
                if (ok) {
                  setMatchOpen(false);
                  setEpisodeId("");
                }
              }}
            >
              <Check aria-hidden="true" /> Confirm match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
