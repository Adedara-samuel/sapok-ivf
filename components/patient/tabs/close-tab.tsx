"use client";

import { useState } from "react";
import { z } from "zod";
import { FolderLock, FolderOpen, Send } from "lucide-react";
import { SelectField, TextareaField, toOptions } from "@/components/forms/fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip, humanize } from "@/components/shared/status-chip";
import type { PatientCtx } from "@/components/patient/types";
import { useLookups } from "@/hooks/use-lookups";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { CloseReason } from "@/lib/schemas/episode";
import { requestFileReopen } from "@/lib/services/workflows";
import { useEpisodeStore } from "@/lib/stores/episode";
import { useRequestStore } from "@/lib/stores/requests";
import { formatDate, formatDateTime } from "@/lib/utils/dates";

const closeForm = z.object({
  closeReason: CloseReason,
  closeNote: z.string().trim().min(5, "Explain why the file is being closed (at least 5 characters)"),
});
type CloseForm = z.infer<typeof closeForm>;

export function CloseTab({ ctx }: { ctx: PatientCtx }) {
  const ep = ctx.episode;
  const run = useRunAction();
  const canClose = usePermission("files.close");
  const { staffName } = useLookups();
  const close = useEpisodeStore((s) => s.close);
  const reopen = useEpisodeStore((s) => s.reopen);
  const requests = useRequestStore((s) => s.requests);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const form = useZodForm<CloseForm>(closeForm, { closeNote: "" });
  if (!ep) return <EmptyState title="No episode" />;
  const reopenRequests = requests
    .filter((r) => r.kind === "file-reopen" && r.entityId === ep.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pending = reopenRequests.find((r) => r.status === "pending");

  if (ep.status === "closed") {
    return (
      <SectionCard title="File closed" description={`Closed on ${formatDate(ep.closedAt)}`}>
        <div className="grid gap-4">
          <Alert>
            <FolderLock aria-hidden="true" />
            <AlertTitle>Outcome: {humanize(ep.closeReason ?? "other")}</AlertTitle>
            <AlertDescription>{ep.closeNote}</AlertDescription>
          </Alert>
          <div className="grid gap-2 rounded-lg border p-4">
            <p className="font-medium">Reopen this file</p>
            <p className="text-muted-foreground text-sm">
              Reopening a closed file requires manager approval. Submit a request; once approved, reopen it here.
            </p>
            {pending ? (
              <p className="text-sm">
                <StatusChip status="pending" label="Awaiting approval" /> requested {formatDateTime(pending.createdAt)}{" "}
                by {staffName(pending.requesterId)}
              </p>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="reopen-reason">Reason for reopening</Label>
                <Textarea
                  id="reopen-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  aria-invalid={Boolean(reasonError)}
                  aria-describedby={reasonError ? "reopen-error" : undefined}
                />
                {reasonError ? (
                  <p id="reopen-error" className="text-destructive text-sm">
                    {reasonError}
                  </p>
                ) : null}
                <Button
                  variant="outline"
                  className="w-fit"
                  onClick={() => {
                    if (reason.trim().length < 5) {
                      setReasonError("Give a reason (at least 5 characters).");
                      return;
                    }
                    setReasonError(null);
                    if (
                      run(() => requestFileReopen(ep.id, reason.trim()), {
                        success: "Reopen request sent to the manager",
                      })
                    )
                      setReason("");
                  }}
                >
                  <Send aria-hidden="true" /> Request approval
                </Button>
              </div>
            )}
            <Button
              className="w-fit"
              onClick={() => run(() => reopen(ep.id), { success: `File ${ep.ivfNo} reopened` })}
            >
              <FolderOpen aria-hidden="true" /> Reopen file
            </Button>
            {reopenRequests.length > 0 ? (
              <ul className="text-muted-foreground mt-2 grid gap-1 text-xs">
                {reopenRequests.map((r) => (
                  <li key={r.id}>
                    {formatDateTime(r.createdAt)} — {r.details} — <StatusChip status={r.status} />
                    {r.comment ? ` “${r.comment}”` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Close file"
      description="Closing records the episode outcome. Notes and orders become read-only."
    >
      {canClose ? (
        <Form {...form}>
          <form noValidate className="grid max-w-xl gap-4" onSubmit={(e) => e.preventDefault()}>
            <SelectField
              control={form.control}
              name="closeReason"
              label="Outcome / reason"
              required
              options={toOptions(CloseReason.options, humanize)}
            />
            <TextareaField
              control={form.control}
              name="closeNote"
              label="Closing note"
              rows={3}
              required
              placeholder="e.g. Live birth of healthy male infant, 3.2 kg, SVD at 39 weeks."
            />
            <ConfirmDialog
              trigger={
                <Button type="button" variant="destructive" className="w-fit">
                  <FolderLock aria-hidden="true" /> Close file
                </Button>
              }
              title={`Close file ${ep.ivfNo}?`}
              description="Reopening later will require manager approval."
              confirmLabel="Close file"
              onConfirm={() => {
                void form.handleSubmit((v) => {
                  run(() => close(ep.id, v), { success: `File ${ep.ivfNo} closed`, setError: form.setError });
                })();
              }}
            />
          </form>
        </Form>
      ) : (
        <EmptyState title="Only doctors and admins can close files" />
      )}
    </SectionCard>
  );
}
