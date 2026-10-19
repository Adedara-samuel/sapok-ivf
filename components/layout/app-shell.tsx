"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarClock, CreditCard } from "lucide-react";
import { AssistantPanel } from "@/components/ai/assistant-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/layout/command-palette";
import { DemoTour } from "@/components/layout/demo-tour";
import { Footer, ResetDemoButton } from "@/components/layout/footer";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useCan } from "@/hooks/use-permission";
import { useSubscription } from "@/hooks/use-tenant";
import { capabilityForPath } from "@/lib/permissions";
import { STATUS_LABELS } from "@/lib/platform/subscription";
import { applyTenant } from "@/lib/stores";
import { audit } from "@/lib/stores/audit";
import { useSessionStore } from "@/lib/stores/session";
import { useUiStore } from "@/lib/stores/ui";
import { formatDate, todayIso } from "@/lib/utils/dates";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const seedDay = useSessionStore((s) => s.seedDay);
  const can = useCan();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const toggleAssistant = useUiStore((s) => s.toggleAssistant);
  const deniedRef = useRef<string | null>(null);

  const { status, message, tenant } = useSubscription();
  const suspended = status === "suspended";
  const required = capabilityForPath(pathname);
  const allowed = !required || can(required);
  const lockedOut = suspended && pathname !== "/subscription";

  // keep the read-only block in step with the subscription (it can change while the app is open)
  useEffect(() => {
    applyTenant(tenant);
  }, [tenant]);

  useEffect(() => {
    if (!userId) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
      return;
    }
    if (lockedOut) {
      router.replace("/subscription");
      return;
    }
    if (!allowed && deniedRef.current !== pathname) {
      deniedRef.current = pathname;
      audit("access-denied", "route", `Access denied to ${pathname} (role: ${role ?? "none"})`);
      router.replace(`/forbidden?from=${encodeURIComponent(pathname)}`);
    }
  }, [userId, allowed, pathname, role, router, lockedOut]);

  const hotkeys = useMemo(
    () => ({
      "mod+k": (e: KeyboardEvent) => {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      },
      "/": (e: KeyboardEvent) => {
        e.preventDefault();
        const search = document.querySelector<HTMLInputElement>("[data-table-search]");
        if (search) search.focus();
        else setPaletteOpen(true);
      },
      n: () => {
        if (can("patients.create")) router.push("/patients/new");
      },
      "mod+j": (e: KeyboardEvent) => {
        e.preventDefault();
        if (can("ai.use")) toggleAssistant();
      },
    }),
    [can, router, toggleAssistant],
  );
  useHotkeys(hotkeys, Boolean(userId));

  if (!userId || !allowed || lockedOut) return null;
  const stale = seedDay !== null && seedDay !== todayIso();

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only z-50 rounded px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenPalette={() => setPaletteOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-6">
          {message && status !== "active" ? (
            <Alert variant={status === "grace" ? "default" : "destructive"} className="no-print mb-4">
              <CreditCard aria-hidden="true" />
              <AlertTitle>{STATUS_LABELS[status]}</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                {message}
                {can("admin.view") && pathname !== "/subscription" ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/subscription">Renew subscription</Link>
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          {stale ? (
            <Alert className="no-print mb-4">
              <CalendarClock aria-hidden="true" />
              <AlertTitle>Demo dates are from {formatDate(seedDay)}</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                The dataset is anchored to the day it was generated. Reset to move every appointment and scan relative
                to today.
                <ResetDemoButton />
              </AlertDescription>
            </Alert>
          ) : null}
          {children}
        </main>
        <Footer />
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      {can("ai.use") ? <AssistantPanel /> : null}
      <DemoTour />
    </div>
  );
}
