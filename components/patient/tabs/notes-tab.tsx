"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { CornerDownRight, FileText, Lock, MessageSquarePlus, Plus } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import type { PatientCtx } from "@/components/patient/types";
import { useLookups } from "@/hooks/use-lookups";
import { useCan } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useZodForm } from "@/hooks/use-zod-form";
import { NOTE_QUICK_PHRASES, NOTE_TEMPLATES } from "@/lib/constants/clinical";
import type { Capability } from "@/lib/permissions";
import type { Note, NoteKind } from "@/lib/schemas/clinical";
import { useClinicalStore } from "@/lib/stores/clinical";
import { formatDateTime } from "@/lib/utils/dates";

const noteForm = z.object({ body: z.string().trim().min(3, "Write at least 3 characters") });
type NoteForm = z.infer<typeof noteForm>;

function NoteComposer({ episodeId, kind, onDone }: { episodeId: string; kind: NoteKind; onDone?: () => void }) {
  const run = useRunAction();
  const addNote = useClinicalStore((s) => s.addNote);
  const form = useZodForm<NoteForm>(noteForm, { body: "" });
  useUnsavedGuard(form.formState.isDirty);
  const append = (text: string) =>
    form.setValue("body", `${form.getValues("body")}${form.getValues("body") ? " " : ""}${text}`, {
      shouldDirty: true,
      shouldValidate: true,
    });
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => {
          if (run(() => addNote(episodeId, kind, v.body), { success: "Note posted", setError: form.setError })) {
            form.reset({ body: "" });
            onDone?.();
          }
        })}
        className="grid gap-3"
        noValidate
      >
        <div className="flex flex-wrap gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <FileText aria-hidden="true" /> Template
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {NOTE_TEMPLATES.map((t) => (
                <DropdownMenuItem
                  key={t.label}
                  onSelect={() => form.setValue("body", t.body, { shouldDirty: true, shouldValidate: true })}
                >
                  {t.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {NOTE_QUICK_PHRASES.map((p) => (
            <Button
              key={p}
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 border border-dashed text-xs"
              onClick={() => append(p)}
            >
              <Plus className="size-3" aria-hidden="true" /> {p}
            </Button>
          ))}
        </div>
        <TextareaField
          control={form.control}
          name="body"
          label={`New ${kind} note`}
          rows={4}
          required
          placeholder="Clinical shorthand is fine, e.g. D8 scan: R 14,12 L 15,13; ET 8.2 mm…"
          description="Posted notes cannot be edited. Corrections are added as addenda."
        />
        <div className="flex justify-end">
          <Button type="submit">Post note</Button>
        </div>
      </form>
    </Form>
  );
}

function NoteItem({ note, addenda, canAmend }: { note: Note; addenda: Note[]; canAmend: boolean }) {
  const { staffName } = useLookups();
  const run = useRunAction();
  const addAddendum = useClinicalStore((s) => s.addAddendum);
  const [open, setOpen] = useState(false);
  const form = useZodForm<NoteForm>(noteForm, { body: "" });
  return (
    <li className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {staffName(note.authorId)}{" "}
          <span className="text-muted-foreground font-normal">· {formatDateTime(note.createdAt)}</span>
        </p>
        <span className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Lock className="size-3" aria-hidden="true" /> Posted
          </Badge>
          {canAmend ? (
            <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
              <MessageSquarePlus aria-hidden="true" /> Addendum
            </Button>
          ) : null}
        </span>
      </div>
      <p className="mt-1 text-sm whitespace-pre-line">{note.body}</p>
      {addenda.length > 0 ? (
        <ul className="mt-2 grid gap-2">
          {addenda.map((a) => (
            <li key={a.id} className="bg-muted/50 flex gap-2 rounded-md p-2 text-sm">
              <CornerDownRight className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="text-muted-foreground block text-xs">
                  Addendum · {staffName(a.authorId)} · {formatDateTime(a.createdAt)}
                </span>
                {a.body}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add addendum</DialogTitle>
            <DialogDescription>
              The original note stays unchanged. Your addendum is time-stamped and attributed to you.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => {
                if (run(() => addAddendum(note.id, v.body), { success: "Addendum added" })) {
                  form.reset();
                  setOpen(false);
                }
              })}
              className="grid gap-3"
              noValidate
            >
              <TextareaField control={form.control} name="body" label="Addendum" rows={3} required />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add addendum</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </li>
  );
}

export function NotesTab({ ctx }: { ctx: PatientCtx }) {
  const ep = ctx.episode;
  const can = useCan();
  const notes = useClinicalStore((s) => s.notes);
  const mine = useMemo(() => (ep ? notes.filter((n) => n.episodeId === ep.id) : []), [notes, ep]);
  if (!ep) return <EmptyState title="No episode" description="Open an episode to start writing notes." />;
  const closed = ep.status === "closed";
  const section = (kind: NoteKind, capability: Capability) => {
    const roots = mine
      .filter((n) => n.kind === kind && !n.addendumOf)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return (
      <div className="grid gap-4">
        {can(capability) && !closed ? <NoteComposer episodeId={ep.id} kind={kind} /> : null}
        {roots.length === 0 ? (
          <EmptyState
            title={`No ${kind} notes yet`}
            description={can(capability) ? "Write the first note above." : "Notes will appear here once posted."}
          />
        ) : (
          <ul className="grid gap-3">
            {roots.map((n) => (
              <NoteItem
                key={n.id}
                note={n}
                addenda={mine
                  .filter((a) => a.addendumOf === n.id)
                  .sort((a, b) => a.createdAt.localeCompare(b.createdAt))}
                canAmend={can(capability) && !closed}
              />
            ))}
          </ul>
        )}
      </div>
    );
  };
  return (
    <SectionCard
      title="Clinical notes"
      description={
        closed ? "This file is closed; notes are read-only." : "Doctor's and nurse's notes for this episode."
      }
    >
      <Tabs defaultValue={can("notes.nurse") && !can("notes.doctor") ? "nurse" : "doctor"}>
        <TabsList>
          <TabsTrigger value="doctor">
            Doctor&apos;s notes ({mine.filter((n) => n.kind === "doctor").length})
          </TabsTrigger>
          <TabsTrigger value="nurse">Nurse notes ({mine.filter((n) => n.kind === "nurse").length})</TabsTrigger>
          <TabsTrigger value="counselling">
            Counselling ({mine.filter((n) => n.kind === "counselling").length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="doctor" className="mt-4">
          {section("doctor", "notes.doctor")}
        </TabsContent>
        <TabsContent value="nurse" className="mt-4">
          {section("nurse", "notes.nurse")}
        </TabsContent>
        <TabsContent value="counselling" className="mt-4">
          {section("counselling", "counselling.manage")}
        </TabsContent>
      </Tabs>
    </SectionCard>
  );
}
