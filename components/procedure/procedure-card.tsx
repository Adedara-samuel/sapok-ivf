"use client";

import { useState } from "react";
import { z } from "zod";
import { CornerDownRight, Lock, MessageSquarePlus, Pencil, PenLine, Trash2 } from "lucide-react";
import { TextareaField } from "@/components/forms/fields";
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
import { PrintDialog } from "@/components/print/print-dialog";
import { PrintSection, PrintSheet, type PrintIdentifier } from "@/components/print/print-sheet";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusChip } from "@/components/shared/status-chip";
import { useLookups } from "@/hooks/use-lookups";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import type { Procedure } from "@/lib/schemas/procedure";
import { useProcedureStore } from "@/lib/stores/procedure";
import { useSettingsStore } from "@/lib/stores/settings";
import { formatDate, formatDateTime } from "@/lib/utils/dates";

const addendumForm = z.object({ body: z.string().trim().min(3, "Write at least 3 characters") });
type AddendumForm = z.infer<typeof addendumForm>;

export function ProcedureCard({
  procedure: p,
  canPost,
  onEdit,
  onSign,
  identifiers,
  branchId,
}: {
  procedure: Procedure;
  canPost: boolean;
  onEdit: () => void;
  onSign: () => void;
  identifiers: PrintIdentifier[];
  branchId: string;
}) {
  const { staffName } = useLookups();
  const run = useRunAction();
  const forms = useSettingsStore((s) => s.procedureForms);
  const addAddendum = useProcedureStore((s) => s.addAddendum);
  const discard = useProcedureStore((s) => s.discardDraft);
  const [addOpen, setAddOpen] = useState(false);
  const form = useZodForm<AddendumForm>(addendumForm, { body: "" });
  const cfg = forms.find((f) => f.type === p.type);
  const facts = [
    { label: "Date", value: `${formatDate(p.date)} ${p.time}` },
    { label: "Surgeon", value: staffName(p.surgeonId) },
    ...(p.embryologistId ? [{ label: "Embryologist", value: staffName(p.embryologistId) }] : []),
    ...(p.scrubNurseId ? [{ label: "Scrub nurse", value: staffName(p.scrubNurseId) }] : []),
    ...(p.count !== undefined ? [{ label: cfg?.countLabel ?? "Count", value: String(p.count) }] : []),
    ...(p.embryoGrade ? [{ label: "Embryo grade", value: p.embryoGrade }] : []),
    ...(p.embryosTransferred !== undefined
      ? [{ label: "Embryos transferred", value: String(p.embryosTransferred) }]
      : []),
  ];

  return (
    <article className="rounded-xl border p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{cfg?.label ?? p.type}</h3>
          <StatusChip status={p.status} />
          {p.status === "posted" ? (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Lock className="size-3" aria-hidden="true" /> Locked
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {p.status === "draft" && canPost ? (
            <>
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Pencil aria-hidden="true" /> Edit
              </Button>
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="ghost" aria-label="Discard draft">
                    <Trash2 />
                  </Button>
                }
                title="Discard this draft?"
                confirmLabel="Discard"
                onConfirm={() => {
                  run(() => discard(p.id), { success: "Draft discarded" });
                }}
              />
              <Button size="sm" onClick={onSign}>
                <PenLine aria-hidden="true" /> Sign & post
              </Button>
            </>
          ) : null}
          {p.status === "posted" && canPost ? (
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <MessageSquarePlus aria-hidden="true" /> Addendum
            </Button>
          ) : null}
          <PrintDialog
            title={`${cfg?.label ?? p.type} report`}
            documentTitle={`${p.type}-report-${p.date}`}
            auditEntity="procedure"
            auditId={p.id}
          >
            {(ref) => (
              <PrintSheet
                ref={ref}
                title={`${cfg?.label ?? p.type} report`}
                identifiers={identifiers}
                branchId={branchId}
              >
                <PrintSection title="Procedure details">
                  <table>
                    <tbody>
                      {facts.map((f) => (
                        <tr key={f.label}>
                          <th className="w-48">{f.label}</th>
                          <td>{f.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </PrintSection>
                <PrintSection title={cfg?.noteLabel ?? "Post-op note"}>
                  <p className="whitespace-pre-line">{p.postOpNote}</p>
                </PrintSection>
                {p.addenda.length > 0 ? (
                  <PrintSection title="Addenda">
                    {p.addenda.map((a) => (
                      <p key={a.id}>
                        {formatDateTime(a.at)} · {staffName(a.authorId)}: {a.body}
                      </p>
                    ))}
                  </PrintSection>
                ) : null}
                <PrintSection title="Signature">
                  {p.signatureDataUrl ? (
                    <div>
                      <img src={p.signatureDataUrl} alt="Surgeon signature" className="h-14" />
                      <p>
                        {staffName(p.surgeonId)} · signed {formatDateTime(p.signedAt)}
                      </p>
                    </div>
                  ) : (
                    <p>DRAFT — not signed</p>
                  )}
                </PrintSection>
              </PrintSheet>
            )}
          </PrintDialog>
        </div>
      </header>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="text-muted-foreground text-xs">{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm whitespace-pre-line">{p.postOpNote}</p>
      {p.signatureDataUrl ? (
        <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
          <img
            src={p.signatureDataUrl}
            alt={`Signature of ${staffName(p.surgeonId)}`}
            className="h-10 rounded border bg-white"
          />
          Signed {formatDateTime(p.signedAt)}
        </div>
      ) : null}
      {p.addenda.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {p.addenda.map((a) => (
            <li key={a.id} className="bg-muted/50 flex gap-2 rounded-md p-2 text-sm">
              <CornerDownRight className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="text-muted-foreground block text-xs">
                  Addendum · {staffName(a.authorId)} · {formatDateTime(a.at)}
                </span>
                {a.body}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Addendum to {p.type} note</DialogTitle>
            <DialogDescription>The posted note stays unchanged.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              noValidate
              className="grid gap-3"
              onSubmit={form.handleSubmit((v) => {
                if (run(() => addAddendum(p.id, v.body), { success: "Addendum added" })) {
                  form.reset();
                  setAddOpen(false);
                }
              })}
            >
              <TextareaField control={form.control} name="body" label="Addendum" rows={3} required />
              <DialogFooter>
                <Button type="submit">Add addendum</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </article>
  );
}
