"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_CONFIG } from "@/lib/config";
import { hydrateAllStores } from "@/lib/stores";

function Splash() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <BrandLogo className="h-14 animate-pulse" />
        <p className="text-muted-foreground text-sm">Loading {APP_CONFIG.name}…</p>
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
  return ready ? <>{children}</> : <Splash />;
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
