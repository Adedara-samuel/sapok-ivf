"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Copy, Lock, Send, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useClinicDb } from "@/hooks/use-clinic-db";
import { useCan } from "@/hooks/use-permission";
import { useActiveTenant } from "@/hooks/use-tenant";
import { askAssistant, suggestionsFor, type AiBlock, type AiReply } from "@/lib/ai/assistant";
import { ROLE_LABELS } from "@/lib/permissions";
import { audit } from "@/lib/stores/audit";
import { useSessionStore } from "@/lib/stores/session";
import { useSettingsStore } from "@/lib/stores/settings";
import { useStaffStore } from "@/lib/stores/staff";
import { useUiStore } from "@/lib/stores/ui";
import { useWalletStore } from "@/lib/stores/wallet";
import { todayIso } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

interface Turn {
  id: number;
  question: string;
  reply: AiReply;
}

function Block({ block, onNavigate }: { block: AiBlock; onNavigate: () => void }) {
  const [draft, setDraft] = useState(block.type === "draft" ? block.text : "");
  switch (block.type) {
    case "text":
      return <p className="text-sm leading-relaxed">{block.text}</p>;
    case "list":
      return (
        <ul className="ml-4 grid list-disc gap-1 text-sm">
          {block.items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {block.columns.map((c, i) => (
                  <TableHead key={`${c}-${i}`} className="h-8 text-xs">
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.rows.map((r, i) => (
                <TableRow key={i}>
                  {r.map((cell, j) => (
                    <TableCell
                      key={j}
                      className={cn("py-1.5 text-xs", j > 0 && /^-?₦/.test(cell) && "text-right tabular-nums")}
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    case "draft":
      return (
        <div className="grid gap-2 rounded-md border p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">{block.title} — editable draft</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(draft)
                  .then(() => toast.success("Draft copied"))
                  .catch(() => toast.error("Copy failed — select the text and copy it manually"));
              }}
            >
              <Copy aria-hidden="true" /> Copy
            </Button>
          </div>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            className="font-mono text-xs"
            aria-label={`${block.title} draft`}
          />
        </div>
      );
    case "links":
      return (
        <div className="flex flex-wrap gap-2">
          {block.links.map((l) => (
            <Button key={l.href} asChild size="sm" variant="secondary">
              <Link href={l.href} onClick={onNavigate}>
                {l.label}
              </Link>
            </Button>
          ))}
        </div>
      );
  }
}

/** Slide-over AI assistant (Ctrl+J). Answers from this hospital's data, within the user's permissions. */
export function AssistantPanel() {
  const open = useUiStore((s) => s.assistantOpen);
  const setOpen = useUiStore((s) => s.setAssistantOpen);
  const pathname = usePathname();
  const can = useCan();
  const tenant = useActiveTenant();
  const db = useClinicDb();
  const wallets = useWalletStore((s) => s.wallets);
  const entries = useWalletStore((s) => s.entries);
  const settlements = useWalletStore((s) => s.settlements);
  const role = useSessionStore((s) => s.role);
  const userId = useSessionStore((s) => s.userId);
  const userName = useStaffStore((s) => s.staff.find((x) => x.id === userId)?.name ?? "Staff");
  const clinicName = useSettingsStore((s) => s.clinic.clinicName);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const patientId = pathname.match(/^\/patients\/(PT-[^/?]+)/)?.[1];
  const walletId = pathname.match(/^\/accounts\/(WAL-[^/?]+)/)?.[1];
  const ctx = useMemo(
    () => ({
      can,
      roleLabel: role ? ROLE_LABELS[role] : "Staff",
      userName,
      clinicName,
      today: todayIso(),
      patientId,
      walletId,
      data: { ...db, wallets, entries, settlements },
    }),
    [can, role, userName, clinicName, patientId, walletId, db, wallets, entries, settlements],
  );
  const suggestions = suggestionsFor(ctx, pathname);
  const enabled = tenant?.aiEnabled !== false;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, thinking]);

  const ask = (text: string) => {
    const q = text.trim();
    if (!q || thinking) return;
    setQuestion("");
    setThinking(true);
    // short pause so the answer reads as a reply rather than a flash
    window.setTimeout(() => {
      let reply: AiReply;
      try {
        reply = askAssistant(q, ctx);
      } catch (error) {
        console.error(error);
        reply = {
          intent: "error",
          blocks: [{ type: "text", text: "Something went wrong answering that. Please rephrase." }],
        };
      }
      audit(
        "view",
        "ai",
        `AI assistant (${reply.intent}${reply.refused ? ", declined" : ""}): “${q.slice(0, 90)}”`,
        patientId ?? walletId,
      );
      setTurns((t) => [...t, { id: Date.now(), question: q, reply }]);
      setThinking(false);
      inputRef.current?.focus();
    }, 350);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <Bot className="text-primary size-5" aria-hidden="true" /> AI assistant
            <Badge variant="secondary" className="text-[10px]">
              Demo AI · offline
            </Badge>
          </SheetTitle>
          <SheetDescription>
            Answers from {clinicName}&apos;s records, limited to what your role can see. Always review before acting.
          </SheetDescription>
        </SheetHeader>

        {!enabled ? (
          <div className="grid flex-1 place-content-center gap-3 p-6 text-center">
            <Lock className="text-muted-foreground mx-auto size-8" aria-hidden="true" />
            <p className="font-medium">The AI assistant isn&apos;t included in your current plan</p>
            <p className="text-muted-foreground text-sm">
              Ask your hospital administrator to upgrade to Professional, or contact Overcare from Subscription &amp;
              support.
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
              {turns.length === 0 ? (
                <div className="grid gap-3">
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Sparkles className="size-4" aria-hidden="true" /> Try one of these:
                  </p>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => ask(s)}
                      className="hover:bg-accent rounded-lg border px-3 py-2 text-left text-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <ol className="grid gap-5">
                  {turns.map((t) => (
                    <li key={t.id} className="grid gap-2">
                      <p className="bg-primary text-primary-foreground ml-auto max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-sm">
                        {t.question}
                      </p>
                      <div
                        className={cn(
                          "bg-muted/60 grid max-w-full gap-2 rounded-2xl rounded-bl-sm px-3 py-2",
                          t.reply.refused && "border-warning/40 border",
                        )}
                      >
                        {t.reply.refused ? (
                          <p className="text-warning flex items-center gap-1 text-xs font-medium">
                            <ShieldAlert className="size-3.5" aria-hidden="true" /> Declined
                          </p>
                        ) : null}
                        {t.reply.blocks.map((b, i) => (
                          <Block key={i} block={b} onNavigate={() => setOpen(false)} />
                        ))}
                        <p className="text-muted-foreground text-[10px]">AI-generated — check against the record.</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {thinking ? (
                <p className="text-muted-foreground mt-4 animate-pulse text-sm" role="status">
                  Looking that up…
                </p>
              ) : null}
              <div ref={endRef} />
            </div>
            <form
              className="flex items-center gap-2 border-t p-3"
              onSubmit={(e) => {
                e.preventDefault();
                ask(question);
              }}
            >
              {turns.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setTurns([])}
                  aria-label="Clear conversation"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              ) : null}
              <Input
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about a patient, account, report…"
                aria-label="Ask the AI assistant"
                maxLength={300}
                autoFocus
              />
              <Button type="submit" size="icon" disabled={!question.trim() || thinking} aria-label="Send">
                <Send aria-hidden="true" />
              </Button>
            </form>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
