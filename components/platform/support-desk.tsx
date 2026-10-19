"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip } from "@/components/shared/status-chip";
import { PRIORITY_TONES, TICKET_TONES, TicketThread } from "@/components/subscription/ticket-thread";
import type { SupportTicket } from "@/lib/schemas/platform";
import { usePlatformStore } from "@/lib/stores/platform";
import { formatDateTime } from "@/lib/utils/dates";

const FILTERS = ["active", "all", "resolved", "closed"] as const;

export function SupportDesk() {
  const router = useRouter();
  const params = useSearchParams();
  const tickets = usePlatformStore((s) => s.tickets);
  const tenants = usePlatformStore((s) => s.tenants);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("active");
  const selectedId = params.get("ticket");

  const rows = useMemo(
    () =>
      tickets
        .filter((t) =>
          filter === "all"
            ? true
            : filter === "active"
              ? t.status === "open" || t.status === "in-progress"
              : t.status === filter,
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [tickets, filter],
  );
  const selected = tickets.find((t) => t.id === selectedId);
  const hospital = (slug: string) => tenants.find((t) => t.slug === slug)?.name ?? slug;

  const columns: ColumnDef<SupportTicket, unknown>[] = [
    { accessorKey: "number", header: "Ticket" },
    { id: "hospital", header: "Hospital", accessorFn: (t) => hospital(t.tenantSlug) },
    {
      accessorKey: "subject",
      header: "Subject",
      cell: ({ row }) => <span className="font-medium">{row.original.subject}</span>,
    },
    { accessorKey: "category", header: "Category", cell: ({ row }) => row.original.category.replace(/-/g, " ") },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => <StatusChip status={row.original.priority} tone={PRIORITY_TONES[row.original.priority]} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} tone={TICKET_TONES[row.original.status]} />,
    },
    { accessorKey: "raisedBy", header: "Raised by" },
    { accessorKey: "updatedAt", header: "Updated", cell: ({ row }) => formatDateTime(row.original.updatedAt) },
  ];

  return (
    <>
      <PageHeader
        title="Support desk"
        description="Tickets from every hospital. Replies appear in the hospital's Subscription & support page."
      />
      <SectionCard
        title={`${rows.length} ticket${rows.length === 1 ? "" : "s"}`}
        actions={
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter tickets">
            {FILTERS.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === "active" ? "Open & in progress" : f.replace(/^\w/, (x) => x.toUpperCase())}
              </Button>
            ))}
          </div>
        }
      >
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search tickets…"
          onRowClick={(t) => router.replace(`/platform/tickets?ticket=${t.id}`, { scroll: false })}
          empty={<EmptyState icon={LifeBuoy} title="No tickets here" />}
        />
      </SectionCard>
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(o) => (!o ? router.replace("/platform/tickets", { scroll: false }) : undefined)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selected.number}: {selected.subject}
                </SheetTitle>
                <SheetDescription>
                  {hospital(selected.tenantSlug)} · {selected.raisedByEmail}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">
                <TicketThread ticket={selected} author="Overcare Support" fromPlatform />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
