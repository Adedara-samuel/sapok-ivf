"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { BrandLogo } from "@/components/layout/brand-logo";
import { TenantTheme } from "@/components/layout/tenant-theme";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { hydrateAllStores } from "@/lib/stores";

function Splash() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <BrandLogo compact className="h-14 animate-pulse" />
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    </div>
  );
}

/** Loads persisted demo data from localStorage before rendering any screen (avoids hydration mismatches). */
function StoreGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void hydrateAllStores().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return ready ? (
    <>
      <TenantTheme />
      {children}
    </>
  ) : (
    <Splash />
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={200}>
        <StoreGate>{children}</StoreGate>
        <Toaster richColors closeButton position="top-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
