"use client";

import { DateRangeFields } from "@/components/shared/date-range-fields";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip, humanize, type Tone } from "@/components/shared/status-chip";
import { useLookups } from "@/hooks/use-lookups";
import { AuditAction, type AuditEvent } from "@/lib/schemas/admin";
import { inRange } from "@/lib/selectors/predicates";
import { useAuditStore } from "@/lib/stores/audit";
import { formatDateTime } from "@/lib/utils/dates";

const ACTION_TONE: Partial<Record<AuditEvent["action"], Tone>> = {
  "access-denied": "critical",
  "break-glass": "critical",
  reset: "waiting",
  cancel: "cancelled",
  approve: "done",
  reject: "critical",
  post: "done",
  sign: "info",
  print: "neutral",
  export: "neutral",
  view: "progress",
};

export function AuditPanel() {
  const events = useAuditStore((s) => s.events);
  const { staffName, staff } = useLookups();
  const [user, setUser] = useState("all");
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const entities = useMemo(() => [...new Set(events.map((e) => e.entity))].sort(), [events]);
  const rows = useMemo(
    () =>
      events
        .filter(
          (e) =>
            (user === "all" || e.actorId === user) &&
            (action === "all" || e.action === action) &&
            (entity === "all" || e.entity === entity) &&
            inRange(e.at, { from: from || undefined, to: to || undefined }),
        )
        .sort((a, b) => b.at.localeCompare(a.at)),
    [events, user, action, entity, from, to],
  );
  const columns: ColumnDef<AuditEvent, unknown>[] = [
    {
      accessorKey: "at",
      header: "When",
      cell: ({ row }) => formatDateTime(row.original.at),
      meta: { exportValue: (r) => formatDateTime(r.at) },
    },
    { id: "actor", header: "User", accessorFn: (e) => staffName(e.actorId) },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => (
        <StatusChip status={row.original.action} tone={ACTION_TONE[row.original.action] ?? "neutral"} />
      ),
    },
    { accessorKey: "entity", header: "Entity" },
    { accessorKey: "summary", header: "Summary" },
    { accessorKey: "entityId", header: "Record" },
  ];
  const select = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    options: { value: string; label: string }[],
  ) => (
    <Select value={value} onValueChange={set}>
      <SelectTrigger id={id} size="sm" className="w-44" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label.toLowerCase()}s</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  return (
    <SectionCard
      title="Audit log"
      description={`${events.length} events · every create, update, post, cancel, print, export and sensitive view`}
    >
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder="Search summaries…"
        exportName="audit-log"
        exportTitle="Audit log"
        initialHidden={{ entityId: false }}
        toolbar={
          <div className="flex flex-wrap items-end gap-2">
            {select(
              "a-user",
              "User",
              user,
              setUser,
              staff.map((s) => ({ value: s.id, label: s.name })),
            )}
            {select(
              "a-action",
              "Action",
              action,
              setAction,
              AuditAction.options.map((a) => ({ value: a, label: humanize(a) })),
            )}
            {select(
              "a-entity",
              "Entity",
              entity,
              setEntity,
              entities.map((e) => ({ value: e, label: humanize(e) })),
            )}
            <DateRangeFields idPrefix="a" from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          </div>
        }
      />
    </SectionCard>
  );
}
