"use client";

import { DatabaseZap, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { rootReset } from "@/lib/stores";
import { useUiStore } from "@/lib/stores/ui";

export function ResetDemoButton({ size = "sm" }: { size?: "sm" | "default" }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size={size}>
          <RotateCcw aria-hidden="true" /> Reset demo data
        </Button>
      }
      title="Reset all demo data?"
      description="Every change made in this browser (patients, notes, payments, settings) will be replaced with the original synthetic dataset. Your sign-in stays active."
      confirmLabel="Reset data"
      onConfirm={() => {
        void rootReset().then(() => toast.success("Demo data restored to the original seed."));
      }}
    />
  );
}

export function Footer() {
  const tourActive = useUiStore((s) => s.tourActive);
  const startTour = useUiStore((s) => s.startTour);
  const endTour = useUiStore((s) => s.endTour);
  return (
    <footer className="no-print text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs md:px-6">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="border-warning/50 text-warning gap-1">
          <DatabaseZap className="size-3" aria-hidden="true" /> Demo data
        </Badge>
        <span>All patients, staff and records are synthetic. Do not enter real patient information.</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={tourActive ? endTour : startTour} aria-pressed={tourActive}>
          <Sparkles aria-hidden="true" /> {tourActive ? "End guided demo" : "Guided demo"}
        </Button>
        <ResetDemoButton />
      </div>
    </footer>
  );
}
