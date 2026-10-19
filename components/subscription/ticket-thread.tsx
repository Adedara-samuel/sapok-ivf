"use client";

import { useState } from "react";
import { Building2, LifeBuoy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusChip } from "@/components/shared/status-chip";
import { useRunAction } from "@/hooks/use-run-action";
import { TicketStatus, type SupportTicket } from "@/lib/schemas/platform";
import { usePlatformStore } from "@/lib/stores/platform";
import { formatDateTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

export const TICKET_TONES = {
  open: "waiting",
  "in-progress": "progress",
  resolved: "done",
  closed: "cancelled",
} as const;

export const PRIORITY_TONES = { low: "neutral", normal: "info", high: "waiting", urgent: "critical" } as const;

/** Conversation on one support ticket; used by hospitals and by the platform support desk. */
export function TicketThread({
  ticket,
  author,
  fromPlatform,
}: {
  ticket: SupportTicket;
  author: string;
  fromPlatform: boolean;
}) {
  const run = useRunAction();
  const reply = usePlatformStore((s) => s.replyTicket);
  const setStatus = usePlatformStore((s) => s.setTicketStatus);
  const [body, setBody] = useState("");
  const closed = ticket.status === "closed";
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={ticket.status} tone={TICKET_TONES[ticket.status]} />
        <StatusChip
          status={ticket.priority}
          tone={PRIORITY_TONES[ticket.priority]}
          label={`${ticket.priority} priority`}
        />
        <Badge variant="outline" className="capitalize">
          {ticket.category.replace(/-/g, " ")}
        </Badge>
        <span className="text-muted-foreground text-xs">
          Raised by {ticket.raisedBy} · {formatDateTime(ticket.createdAt)}
        </span>
      </div>
      <ol className="grid gap-3">
        {ticket.messages.map((m) => (
          <li
            key={m.id}
            className={cn(
              "max-w-[90%] rounded-xl border p-3 text-sm",
              m.fromPlatform === fromPlatform ? "bg-primary/5 ml-auto" : "bg-muted/50",
            )}
          >
            <p className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
              {m.fromPlatform ? (
                <LifeBuoy className="size-3.5" aria-hidden="true" />
              ) : (
                <Building2 className="size-3.5" aria-hidden="true" />
              )}
              {m.author} · {formatDateTime(m.at)}
            </p>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ol>
      {!closed ? (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              run(() => reply(ticket.id, body, { name: author, fromPlatform }), {
                success: "Reply sent",
                allowReadOnly: true,
              })
            )
              setBody("");
          }}
        >
          <Label htmlFor={`reply-${ticket.id}`}>Reply</Label>
          <Textarea
            id={`reply-${ticket.id}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder={fromPlatform ? "Reply to the hospital…" : "Add details or answer support…"}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {fromPlatform ? (
              <div className="flex items-center gap-2">
                <Label htmlFor={`status-${ticket.id}`} className="text-xs">
                  Status
                </Label>
                <Select
                  value={ticket.status}
                  onValueChange={(v) =>
                    run(() => setStatus(ticket.id, TicketStatus.parse(v), author), {
                      success: `Ticket marked ${v}`,
                      allowReadOnly: true,
                    })
                  }
                >
                  <SelectTrigger id={`status-${ticket.id}`} size="sm" className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TicketStatus.options.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/-/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : ticket.status === "resolved" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  run(() => setStatus(ticket.id, "closed", author), { success: "Ticket closed", allowReadOnly: true })
                }
              >
                Confirm fixed &amp; close
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm" disabled={body.trim().length < 2}>
              Send reply
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-muted-foreground text-sm">This ticket is closed.</p>
      )}
    </div>
  );
}
