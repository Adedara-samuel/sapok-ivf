"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CommandPalette } from "@/components/layout/command-palette";
import { DemoTour } from "@/components/layout/demo-tour";
import { Footer, ResetDemoButton } from "@/components/layout/footer";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useCan } from "@/hooks/use-permission";
import { capabilityForPath } from "@/lib/permissions";
import { audit } from "@/lib/stores/audit";
import { useSessionStore } from "@/lib/stores/session";
import { formatDate, todayIso } from "@/lib/utils/dates";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const seedDay = useSessionStore((s) => s.seedDay);
  const can = useCan();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const deniedRef = useRef<string | null>(null);

  const required = capabilityForPath(pathname);
  const allowed = !required || can(required);

  useEffect(() => {
    if (!userId) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!allowed && deniedRef.current !== pathname) {
      deniedRef.current = pathname;
      audit("access-denied", "route", `Access denied to ${pathname} (role: ${role ?? "none"})`);
      router.replace(`/forbidden?from=${encodeURIComponent(pathname)}`);
    }
  }, [userId, allowed, pathname, role, router]);

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
    }),
    [can, router],
  );
  useHotkeys(hotkeys, Boolean(userId));

  if (!userId || !allowed) return null;
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
      <DemoTour />
    </div>
  );
}
