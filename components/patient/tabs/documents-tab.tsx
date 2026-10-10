"use client";

import { useMemo, useRef, useState } from "react";
import { Eye, FileText, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { humanize } from "@/components/shared/status-chip";
import type { PatientCtx } from "@/components/patient/types";
import { useLookups } from "@/hooks/use-lookups";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { documentSchema, type PatientDocument } from "@/lib/schemas/admin";
import { useClinicalStore } from "@/lib/stores/clinical";
import { formatDateTime } from "@/lib/utils/dates";

const CATEGORIES = documentSchema.shape.category.options;
const INLINE_LIMIT_KB = 700;

export function DocumentsTab({ ctx }: { ctx: PatientCtx }) {
  const ep = ctx.episode;
  const run = useRunAction();
  const canManage = usePermission("documents.manage");
  const { staffName } = useLookups();
  const docs = useClinicalStore((s) => s.documents);
  const addDocument = useClinicalStore((s) => s.addDocument);
  const removeDocument = useClinicalStore((s) => s.removeDocument);
  const [category, setCategory] = useState<PatientDocument["category"]>("referral");
  const [filter, setFilter] = useState<string>("all");
  const [preview, setPreview] = useState<PatientDocument | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const list = useMemo(
    () =>
      ep
        ? docs
            .filter((d) => d.episodeId === ep.id && (filter === "all" || d.category === filter))
            .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
        : [],
    [docs, ep, filter],
  );
  if (!ep) return <EmptyState title="No episode" description="Open an episode first." />;

  const upload = (file: File | undefined) => {
    if (!file) return;
    const sizeKb = Math.round(file.size / 1024);
    const finish = (dataUrl?: string) =>
      run(
        () =>
          addDocument(ep.id, {
            name: file.name,
            category,
            sizeKb,
            mime: file.type || "application/octet-stream",
            dataUrl,
          }),
        { success: `Uploaded ${file.name}` },
      );
    if (sizeKb <= INLINE_LIMIT_KB && (file.type.startsWith("image/") || file.type === "application/pdf")) {
      const reader = new FileReader();
      reader.onload = () => finish(typeof reader.result === "string" ? reader.result : undefined);
      reader.readAsDataURL(file);
    } else finish();
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <SectionCard
      title="Documents"
      description={`Mock upload — files stay in this browser. Previews for images/PDFs up to ${INLINE_LIMIT_KB} KB.`}
      actions={
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger size="sm" className="w-40" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {humanize(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {canManage && ep.status !== "closed" ? (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-dashed p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="doc-cat">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as PatientDocument["category"])}>
              <SelectTrigger id="doc-cat" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {humanize(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input
            ref={fileRef}
            id="doc-file"
            type="file"
            className="sr-only"
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <Button type="button" onClick={() => fileRef.current?.click()}>
            <Upload aria-hidden="true" /> Upload file
          </Button>
        </div>
      ) : null}
      {list.length === 0 ? (
        <EmptyState title="No documents" description="Upload referral letters, scan images and reports here." />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {list.map((d) => {
            const Icon = d.mime.startsWith("image/") ? ImageIcon : FileText;
            return (
              <li key={d.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Icon className="text-primary size-8 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {humanize(d.category)} · {d.sizeKb} KB · {formatDateTime(d.uploadedAt)} · {staffName(d.uploadedBy)}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setPreview(d)} aria-label={`Preview ${d.name}`}>
                  <Eye />
                </Button>
                {canManage ? (
                  <ConfirmDialog
                    trigger={
                      <Button size="icon" variant="ghost" aria-label={`Delete ${d.name}`}>
                        <Trash2 />
                      </Button>
                    }
                    title={`Delete ${d.name}?`}
                    description="The file will be removed from this patient's record."
                    confirmLabel="Delete"
                    onConfirm={() => {
                      run(() => removeDocument(d.id), { success: "Document removed" });
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={preview !== null} onOpenChange={(o) => (!o ? setPreview(null) : undefined)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
            <DialogDescription>
              {preview ? `${humanize(preview.category)} · ${preview.sizeKb} KB` : ""}
            </DialogDescription>
          </DialogHeader>
          {preview?.dataUrl ? (
            preview.mime.startsWith("image/") ? (
              <img src={preview.dataUrl} alt={preview.name} className="max-h-[70vh] w-full rounded-lg object-contain" />
            ) : (
              <iframe src={preview.dataUrl} title={preview.name} className="h-[70vh] w-full rounded-lg border" />
            )
          ) : (
            <EmptyState
              icon={FileText}
              title="Preview not available"
              description="This demo file has no stored content (seeded record or large file). In production the file would open from document storage."
            />
          )}
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
