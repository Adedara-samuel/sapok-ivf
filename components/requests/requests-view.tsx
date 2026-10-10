"use client";

import { FilePicker } from "@/components/shared/file-picker";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";
import { Check, Plus, X } from "lucide-react";
import { NumberField, SelectField, TextField, TextareaField, DateField } from "@/components/forms/fields";
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
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/patient/toggle-chip";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip, humanize } from "@/components/shared/status-chip";
import { useLookups } from "@/hooks/use-lookups";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { APP_CONFIG } from "@/lib/config";
import { isoDate } from "@/lib/schemas/common";
import type { RequestKind, StaffRequest } from "@/lib/schemas/admin";
import { leaveDaysUsed, REQUEST_KIND_LABELS, useRequestStore } from "@/lib/stores/requests";
import { useSessionStore } from "@/lib/stores/session";
import { formatDate, formatDateTime, todayIso } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";

const STAFF_KINDS = ["item", "leave", "job", "manpower", "reimbursement", "confirmation"] as const;
type StaffKind = (typeof STAFF_KINDS)[number];

const newForm = z
  .object({
    kind: z.enum(STAFF_KINDS),
    title: z.string().trim().min(3, "Give the request a short title"),
    details: z.string().trim().min(3, "Add a few details"),
    amount: z.number().nonnegative().optional(),
    startDate: isoDate.optional().or(z.literal("")),
    endDate: isoDate.optional().or(z.literal("")),
  })
  .refine((v) => v.kind !== "leave" || (v.startDate && v.endDate), {
    message: "Choose the leave dates",
    path: ["startDate"],
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  })
  .refine((v) => !["reimbursement", "item"].includes(v.kind) || (v.amount ?? 0) > 0, {
    message: "Enter the amount",
    path: ["amount"],
  });
type NewForm = z.infer<typeof newForm>;

interface Row extends StaffRequest {
  requester: string;
  approver: string;
}

export function RequestsView() {
  const router = useRouter();
  const params = useSearchParams();
  const run = useRunAction();
  const canApprove = usePermission("requests.approve");
  const userId = useSessionStore((s) => s.userId);
  const requests = useRequestStore((s) => s.requests);
  const create = useRequestStore((s) => s.create);
  const decide = useRequestStore((s) => s.decide);
  const { staffName } = useLookups();
  const typeParam = params.get("type");
  const [tab, setTab] = useState<string>(params.get("tab") === "approvals" && canApprove ? "approvals" : "mine");
  const [kind, setKind] = useState<string>(
    typeParam && (STAFF_KINDS as readonly string[]).includes(typeParam) ? typeParam : "all",
  );
  const [status, setStatus] = useState("all");
  const [newOpen, setNewOpen] = useState(params.get("new") === "1");
  const [deciding, setDeciding] = useState<{ row: Row; approve: boolean } | null>(null);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<string | undefined>();
  const year = todayIso().slice(0, 4);
  const used = userId ? leaveDaysUsed(requests, userId, year) : 0;
  const form = useZodForm<NewForm>(newForm, {
    kind: (kind === "all" ? "item" : kind) as StaffKind,
    title: "",
    details: "",
    startDate: "",
    endDate: "",
  });
  const formKind = form.watch("kind");
  const start = form.watch("startDate");
  const end = form.watch("endDate");
  const requestedDays =
    start && end && end >= start ? Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1 : 0;

  const rows = useMemo<Row[]>(() => {
    const base = requests.filter((r) =>
      tab === "mine"
        ? r.requesterId === userId
        : tab === "approvals"
          ? r.status === "pending" && r.requesterId !== userId
          : true,
    );
    return base
      .filter((r) => (kind === "all" || r.kind === kind) && (status === "all" || r.status === status))
      .map((r) => ({ ...r, requester: staffName(r.requesterId), approver: staffName(r.approverId) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [requests, tab, userId, kind, status, staffName]);

  const pendingForMe = requests.filter((r) => r.status === "pending" && r.requesterId !== userId).length;

  const columns: ColumnDef<Row, unknown>[] = [
    {
      accessorKey: "createdAt",
      header: "Submitted",
      cell: ({ row }) => formatDate(row.original.createdAt),
      meta: { exportValue: (r) => formatDate(r.createdAt) },
    },
    {
      accessorKey: "kind",
      header: "Type",
      cell: ({ row }) => <Badge variant="secondary">{REQUEST_KIND_LABELS[row.original.kind]}</Badge>,
      meta: { exportValue: (r) => REQUEST_KIND_LABELS[r.kind] },
    },
    {
      accessorKey: "title",
      header: "Request",
      cell: ({ row }) => (
        <span>
          <span className="block font-medium">{row.original.title}</span>
          <span className="text-muted-foreground block max-w-md truncate text-xs">{row.original.details}</span>
        </span>
      ),
    },
    { accessorKey: "requester", header: "Requested by" },
    {
      id: "detail",
      header: "Amount / dates",
      accessorFn: (r) =>
        r.amount ? formatMoney(r.amount) : r.startDate ? `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` : "",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span className="grid gap-0.5">
          <StatusChip status={row.original.status} />
          {row.original.decidedAt ? (
            <span className="text-muted-foreground text-xs">
              {row.original.approver} · {formatDateTime(row.original.decidedAt)}
            </span>
          ) : null}
          {row.original.comment ? (
            <span className="text-muted-foreground text-xs italic">“{row.original.comment}”</span>
          ) : null}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      cell: ({ row }) =>
        canApprove && row.original.status === "pending" && row.original.requesterId !== userId ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" onClick={() => setDeciding({ row: row.original, approve: true })}>
              <Check aria-hidden="true" /> Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDeciding({ row: row.original, approve: false })}>
              <X aria-hidden="true" /> Reject
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Requests"
        description="Item, leave, job, manpower, reimbursement and confirmation requests with a single approvals workflow."
        crumbs={[{ label: "Management" }, { label: "Requests" }]}
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus aria-hidden="true" /> New request
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="mine">My requests</TabsTrigger>
            {canApprove ? <TabsTrigger value="approvals">Approvals inbox ({pendingForMe})</TabsTrigger> : null}
            {canApprove ? <TabsTrigger value="all">All requests</TabsTrigger> : null}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Request type">
          {["all", ...STAFF_KINDS, "refund", "file-reopen"].map((k) => (
            <Toggle
              key={k}
              pressed={kind === k}
              onPressedChange={() => {
                setKind(k);
                router.replace(k === "all" ? "/requests" : `/requests?type=${k}`, { scroll: false });
              }}
            >
              {k === "all" ? "All types" : REQUEST_KIND_LABELS[k as RequestKind]}
            </Toggle>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
          {["all", "pending", "approved", "rejected"].map((s) => (
            <Toggle key={s} pressed={status === s} onPressedChange={() => setStatus(s)}>
              {humanize(s)}
            </Toggle>
          ))}
        </div>
      </div>
      <SectionCard
        title={tab === "approvals" ? "Awaiting your decision" : tab === "mine" ? "My requests" : "All requests"}
        description={`Annual leave: ${used} of ${APP_CONFIG.annualLeaveDays} days used in ${year} · ${APP_CONFIG.annualLeaveDays - used} remaining`}
      >
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search requests…"
          exportName={`requests-${tab}`}
          exportTitle="Staff requests"
          empty={
            <EmptyState
              title={tab === "approvals" ? "Nothing to approve" : "No requests yet"}
              description={tab === "approvals" ? "You're all caught up." : "Use New request to submit one."}
            />
          }
        />
      </SectionCard>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New request</DialogTitle>
            <DialogDescription>
              Sent to the branch manager for approval. You&apos;ll be notified of the decision.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              noValidate
              className="grid gap-4"
              onSubmit={form.handleSubmit((v) => {
                if (v.kind === "leave" && requestedDays > APP_CONFIG.annualLeaveDays - used) {
                  form.setError("endDate", {
                    message: `Only ${APP_CONFIG.annualLeaveDays - used} leave day(s) remaining this year`,
                  });
                  return;
                }
                const res = run(
                  () =>
                    create({
                      kind: v.kind,
                      title: v.title,
                      details: v.details,
                      amount: v.amount,
                      startDate: v.startDate || undefined,
                      endDate: v.endDate || undefined,
                      attachmentName: v.kind === "reimbursement" ? attachment : undefined,
                    }),
                  { success: "Request submitted for approval", setError: form.setError },
                );
                if (res) {
                  form.reset();
                  setAttachment(undefined);
                  setNewOpen(false);
                  setTab("mine");
                }
              })}
            >
              <SelectField
                control={form.control}
                name="kind"
                label="Request type"
                required
                options={STAFF_KINDS.map((k) => ({ value: k, label: REQUEST_KIND_LABELS[k] }))}
              />
              <TextField control={form.control} name="title" label="Title" required />
              <TextareaField control={form.control} name="details" label="Details" rows={3} required />
              {formKind === "item" || formKind === "reimbursement" ? (
                <NumberField control={form.control} name="amount" label="Amount (₦)" step="100" min={0} required />
              ) : null}
              {formKind === "leave" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <DateField control={form.control} name="startDate" label="From" required />
                  <DateField control={form.control} name="endDate" label="To" required />
                  <p className="text-muted-foreground text-xs sm:col-span-2">
                    {requestedDays > 0 ? `${requestedDays} day(s) requested · ` : ""}
                    {APP_CONFIG.annualLeaveDays - used} day(s) remaining
                  </p>
                </div>
              ) : null}
              {formKind === "reimbursement" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="receipt-upload">Receipt (mock upload)</Label>
                  <FilePicker
                    id="receipt-upload"
                    accept="image/*,.pdf"
                    fileName={attachment}
                    onChange={(f) => setAttachment(f?.name)}
                    label="Attach receipt"
                  />
                </div>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Submit</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deciding !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDeciding(null);
            setComment("");
            setCommentError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deciding?.approve ? "Approve" : "Reject"} “{deciding?.row.title}”
            </DialogTitle>
            <DialogDescription>
              Requested by {deciding?.row.requester} on {formatDate(deciding?.row.createdAt)}.{" "}
              {deciding?.row.kind === "leave" && deciding.row.startDate
                ? `Leave ${formatDate(deciding.row.startDate)} – ${formatDate(deciding.row.endDate)}.`
                : ""}
              {deciding?.row.amount ? ` Amount ${formatMoney(deciding.row.amount)}.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="decision-comment">
              {deciding?.approve ? "Comment (optional)" : "Reason for rejecting"}
            </Label>
            <Textarea
              id="decision-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              aria-invalid={Boolean(commentError)}
              aria-describedby={commentError ? "decision-error" : undefined}
            />
            {commentError ? (
              <p id="decision-error" className="text-destructive text-sm">
                {commentError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeciding(null)}>
              Cancel
            </Button>
            <Button
              variant={deciding?.approve ? "default" : "destructive"}
              onClick={() => {
                if (!deciding) return;
                if (!deciding.approve && comment.trim().length < 3) {
                  setCommentError("Give a short reason when rejecting.");
                  return;
                }
                if (
                  run(() => decide(deciding.row.id, deciding.approve, comment), {
                    success: `Request ${deciding.approve ? "approved" : "rejected"} — requester notified`,
                  })
                ) {
                  setDeciding(null);
                  setComment("");
                }
              }}
            >
              {deciding?.approve ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
