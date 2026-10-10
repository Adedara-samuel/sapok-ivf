"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { FilterX, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip, humanize } from "@/components/shared/status-chip";
import { Can } from "@/hooks/use-permission";
import { EPISODE_TYPE_LABELS, STAGE_LABELS } from "@/lib/constants/clinical";
import { PayerCategory } from "@/lib/schemas/common";
import { CycleStage } from "@/lib/schemas/cycle";
import { EpisodeType } from "@/lib/schemas/episode";
import { inRange } from "@/lib/selectors/predicates";
import { patientRows, type PatientRow } from "@/lib/selectors/patients";
import { useCycleStore } from "@/lib/stores/cycle";
import { useEpisodeStore } from "@/lib/stores/episode";
import { usePersonStore } from "@/lib/stores/person";
import { useSessionStore } from "@/lib/stores/session";
import { useSettingsStore } from "@/lib/stores/settings";
import { useStaffStore } from "@/lib/stores/staff";
import { formatAge, formatDate } from "@/lib/utils/dates";

const ALL = "all";

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} size="sm" className="w-auto min-w-36" aria-label={label}>
        <span className="text-muted-foreground text-xs">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PatientsListView() {
  const router = useRouter();
  const params = useSearchParams();
  const persons = usePersonStore((s) => s.persons);
  const episodes = useEpisodeStore((s) => s.episodes);
  const cycles = useCycleStore((s) => s.cycles);
  const staff = useStaffStore((s) => s.staff);
  const sessionBranch = useSessionStore((s) => s.branchId);
  const branches = useSettingsStore((s) => s.branches);

  const [status, setStatus] = useState(params.get("status") ?? ALL);
  const [type, setType] = useState(params.get("type") ?? ALL);
  const [doctor, setDoctor] = useState(ALL);
  const [payer, setPayer] = useState(ALL);
  const [stage, setStage] = useState(params.get("view") === "active-cycles" ? "active" : ALL);
  const [branch, setBranch] = useState(params.get("branch") ?? sessionBranch);
  const closedRange = { from: params.get("from") ?? undefined, to: params.get("to") ?? undefined };

  const rows = useMemo(() => patientRows(persons, episodes, cycles, staff), [persons, episodes, cycles, staff]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (branch === ALL || r.branchId === branch) &&
          (status === ALL || r.status === status) &&
          (status !== "closed" || inRange(r.closedAt, closedRange)) &&
          (type === ALL || r.episodeType === type) &&
          (doctor === ALL || r.doctorId === doctor) &&
          (payer === ALL || r.category === payer) &&
          (stage === ALL || (stage === "active" ? r.hasActiveCycle : r.stageKey === stage)),
      ),
    [rows, branch, status, type, doctor, payer, stage, closedRange.from, closedRange.to], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const columns: ColumnDef<PatientRow, unknown>[] = [
    { accessorKey: "prn", header: "PRN" },
    { accessorKey: "ivfNo", header: "IVF no" },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <Link
          href={`/patients/${row.original.id}`}
          className="font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.name}
        </Link>
      ),
    },
    { accessorKey: "partner", header: "Partner" },
    {
      id: "age",
      header: "Age",
      accessorFn: (r) => r.dob,
      cell: ({ row }) => <span className="tabular-nums">{formatAge(row.original.dob, true)}</span>,
      meta: { exportValue: (r) => formatAge(r.dob, true), label: "Age" },
      sortingFn: (a, b) => b.original.dob.localeCompare(a.original.dob),
    },
    { accessorKey: "category", header: "Category", cell: ({ row }) => humanize(row.original.category) },
    { accessorKey: "phone", header: "Mobile" },
    {
      accessorKey: "episodeType",
      header: "Type",
      cell: ({ row }) => (row.original.episodeType === "—" ? "—" : EPISODE_TYPE_LABELS[row.original.episodeType]),
    },
    { accessorKey: "stage", header: "Current stage" },
    { accessorKey: "doctor", header: "Doctor" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} />,
      meta: { exportValue: (r) => r.status },
    },
    {
      id: "closedAt",
      header: "Closed",
      accessorFn: (r) => r.closedAt ?? "",
      cell: ({ row }) => formatDate(row.original.closedAt),
    },
  ];

  const anyFilter =
    status !== ALL || type !== ALL || doctor !== ALL || payer !== ALL || stage !== ALL || branch !== sessionBranch;

  return (
    <>
      <PageHeader
        title="Existing patients"
        description="All registered IVF patients with their current episode and cycle stage."
        crumbs={[{ label: "Patients" }, { label: "Existing patients" }]}
        actions={
          <Can capability="patients.create">
            <Button asChild>
              <Link href="/patients/new">
                <UserPlus aria-hidden="true" /> New registration
              </Link>
            </Button>
          </Can>
        }
      />
      {status === "closed" && (closedRange.from || closedRange.to) ? (
        <div className="mb-3">
          <Badge variant="secondary">
            Closed between {formatDate(closedRange.from)} and {formatDate(closedRange.to)}
          </Badge>
        </div>
      ) : null}
      <SectionCard
        title={`${filtered.length} patient${filtered.length === 1 ? "" : "s"}`}
        description="Click a row to open the patient file."
      >
        <DataTable
          data={filtered}
          columns={columns}
          searchPlaceholder="Search name, PRN, IVF no, phone…"
          exportName="ivf-patients"
          exportTitle="IVF patient list"
          onRowClick={(r) => router.push(`/patients/${r.id}`)}
          initialHidden={{ closedAt: status === "closed" }}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              {branches.length > 1 ? (
                <FilterSelect
                  id="f-branch"
                  label="Branch"
                  value={branch}
                  onChange={setBranch}
                  options={branches.map((b) => ({ value: b.id, label: b.short }))}
                />
              ) : null}
              <FilterSelect
                id="f-status"
                label="Status"
                value={status}
                onChange={setStatus}
                options={["open", "on-hold", "closed", "registered"].map((s) => ({ value: s, label: humanize(s) }))}
              />
              <FilterSelect
                id="f-type"
                label="Type"
                value={type}
                onChange={setType}
                options={EpisodeType.options.map((t) => ({ value: t, label: EPISODE_TYPE_LABELS[t] }))}
              />
              <FilterSelect
                id="f-doctor"
                label="Doctor"
                value={doctor}
                onChange={setDoctor}
                options={staff.filter((s) => s.role === "doctor").map((s) => ({ value: s.id, label: s.name }))}
              />
              <FilterSelect
                id="f-payer"
                label="Payer"
                value={payer}
                onChange={setPayer}
                options={PayerCategory.options.map((p) => ({ value: p, label: humanize(p) }))}
              />
              <FilterSelect
                id="f-stage"
                label="Stage"
                value={stage}
                onChange={setStage}
                options={[
                  { value: "active", label: "Any active cycle" },
                  ...CycleStage.options.map((s) => ({ value: s, label: STAGE_LABELS[s] })),
                ]}
              />
              {anyFilter ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatus(ALL);
                    setType(ALL);
                    setDoctor(ALL);
                    setPayer(ALL);
                    setStage(ALL);
                    setBranch(sessionBranch);
                    router.replace("/patients");
                  }}
                >
                  <FilterX aria-hidden="true" /> Clear
                </Button>
              ) : null}
            </div>
          }
        />
      </SectionCard>
    </>
  );
}
