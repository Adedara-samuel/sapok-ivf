"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { BrandLogo } from "@/components/layout/brand-logo";
import { TenantTheme } from "@/components/layout/tenant-theme";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_CONFIG } from "@/lib/config";
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

/** Shown if saved data can't be loaded (e.g. corrupted or from an incompatible version). */
function LoadFailed({ message }: { message: string }) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-6" role="alert">
      <div className="grid max-w-md gap-3 text-center">
        <p className="text-lg font-semibold">The demo data in this browser couldn&apos;t be loaded</p>
        <p className="text-muted-foreground text-sm">{message}</p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
          <Button
            onClick={() => {
              // remove only this app's saved data, then start fresh from the seed
              Object.keys(localStorage)
                .filter(
                  (k) => k.startsWith(`${APP_CONFIG.storagePrefix}:`) || k.startsWith(`${APP_CONFIG.storagePrefix}@`),
                )
                .forEach((k) => localStorage.removeItem(k));
              window.location.replace("/login");
            }}
          >
            Reset demo data
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Loads persisted demo data from localStorage before rendering any screen (avoids hydration mismatches). */
function StoreGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "failed"; message?: string }>({
    status: "loading",
  });
  useEffect(() => {
    let cancelled = false;
    hydrateAllStores()
      .then(() => {
        if (!cancelled) setState({ status: "ready" });
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!cancelled)
          setState({ status: "failed", message: error instanceof Error ? error.message : "Unknown error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (state.status === "failed") return <LoadFailed message={state.message ?? ""} />;
  return state.status === "ready" ? (
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
