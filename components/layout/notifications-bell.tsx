"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, CheckCheck, ClipboardCheck, FlaskConical, Pill, Snowflake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useClinicDb } from "@/hooks/use-clinic-db";
import { useCan } from "@/hooks/use-permission";
import { computeAlerts, type AlertKind } from "@/lib/selectors/dashboard";
import { useNotificationStore } from "@/lib/stores/notifications";
import { useSessionStore } from "@/lib/stores/session";
import { formatDateTime, todayIso } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

const ICONS: Record<AlertKind, typeof Bell> = {
  cryo: Snowflake,
  "low-stock": Pill,
  expiry: Pill,
  vitals: AlertTriangle,
  critical: FlaskConical,
};

export function NotificationsBell() {
  const db = useClinicDb();
  const can = useCan();
  const userId = useSessionStore((s) => s.userId);
  const branchId = useSessionStore((s) => s.branchId);
  const all = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  const alerts = useMemo(() => {
    const relevant = (k: AlertKind) =>
      k === "cryo"
        ? can("embryology.view")
        : k === "low-stock" || k === "expiry"
          ? can("pharmacy.view")
          : can("clinical.view");
    return computeAlerts(db, todayIso(), { branchId }).filter((a) => relevant(a.kind));
  }, [db, branchId, can]);
  const mine = useMemo(
    () => all.filter((n) => n.userId === userId).sort((a, b) => b.at.localeCompare(a.at)),
    [all, userId],
  );
  const pendingApprovals = can("requests.approve")
    ? db.requests.filter((r) => r.status === "pending" && r.requesterId !== userId).length
    : 0;
  const unread = mine.filter((n) => !n.read).length;
  const critical = alerts.filter((a) => a.severity === "critical").length;
  const badge = unread + critical + (pendingApprovals > 0 ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${badge ? `, ${badge} need attention` : ""}`}
        >
          <Bell aria-hidden="true" />
          {badge > 0 ? (
            <span className="bg-destructive absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="font-semibold">Notifications</p>
          {unread > 0 && userId ? (
            <Button variant="ghost" size="sm" onClick={() => markAllRead(userId)}>
              <CheckCheck aria-hidden="true" /> Mark all read
            </Button>
          ) : null}
        </div>
        <Separator />
        <ScrollArea className="h-[420px]">
          <div className="grid gap-1 p-2">
            {pendingApprovals > 0 ? (
              <Link href="/requests?tab=approvals" className="hover:bg-accent flex gap-3 rounded-lg p-2">
                <ClipboardCheck className="text-warning mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="text-sm">
                  <span className="font-medium">{pendingApprovals} request(s) awaiting your approval</span>
                  <span className="text-muted-foreground block text-xs">Open the approvals inbox</span>
                </span>
              </Link>
            ) : null}
            {mine.slice(0, 15).map((n) => (
              <Link
                key={n.id}
                href={n.href ?? "/dashboard"}
                onClick={() => markRead(n.id)}
                className={cn("hover:bg-accent flex gap-3 rounded-lg p-2", !n.read && "bg-primary/5")}
              >
                <span
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")}
                  aria-hidden="true"
                />
                <span className="text-sm">
                  <span className="font-medium">{n.title}</span>
                  {!n.read ? <span className="sr-only"> (unread)</span> : null}
                  <span className="text-muted-foreground block text-xs">{n.body}</span>
                  <span className="text-muted-foreground block text-[11px]">{formatDateTime(n.at)}</span>
                </span>
              </Link>
            ))}
            {alerts.length > 0 ? (
              <p className="text-muted-foreground px-2 pt-2 text-[11px] font-semibold tracking-wider uppercase">
                Clinical & stock alerts
              </p>
            ) : null}
            {alerts.slice(0, 25).map((a) => {
              const Icon = ICONS[a.kind];
              return (
                <Link key={a.id} href={a.href} className="hover:bg-accent flex gap-3 rounded-lg p-2">
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      a.severity === "critical" ? "text-destructive" : "text-warning",
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      {a.title}
                      {a.severity === "critical" ? (
                        <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                          Critical
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground block text-xs">{a.detail}</span>
                  </span>
                </Link>
              );
            })}
            {mine.length === 0 && alerts.length === 0 && pendingApprovals === 0 ? (
              <p className="text-muted-foreground p-6 text-center text-sm">You&apos;re all caught up.</p>
            ) : null}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
