"use client";

import { useRef } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ResetDemoButton } from "@/components/layout/footer";
import { SectionCard } from "@/components/shared/section-card";
import { usePermission } from "@/hooks/use-permission";
import { importAllData } from "@/lib/services/data-tools";
import { exportAllData } from "@/lib/stores";
import { audit } from "@/lib/stores/audit";
import { isDomainError } from "@/lib/stores/core";
import { downloadBlob } from "@/lib/utils/export";
import { todayIso } from "@/lib/utils/dates";

export function DataToolsPanel() {
  const canSettings = usePermission("admin.settings");
  const fileRef = useRef<HTMLInputElement>(null);
  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const json: unknown = JSON.parse(await file.text());
      importAllData(json);
      toast.success(`Imported ${file.name}`);
    } catch (e) {
      toast.error(isDomainError(e) ? `Import rejected: ${e.message}` : "That file is not a valid RHV IVF export.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <SectionCard
        title="Reset demo data"
        description="Restore the original synthetic dataset (dates move relative to today)."
      >
        <ResetDemoButton size="default" />
      </SectionCard>
      <SectionCard title="Export all data" description="Download every record in this browser as one JSON file.">
        <Button
          variant="outline"
          onClick={() => {
            downloadBlob(
              JSON.stringify(exportAllData(), null, 2),
              `rhv-ivf-export-${todayIso()}.json`,
              "application/json",
            );
            audit("export", "system", "Exported all data (JSON)");
          }}
        >
          <Download aria-hidden="true" /> Export JSON
        </Button>
      </SectionCard>
      <SectionCard
        title="Import data"
        description="Replace all records with a previously exported file. Every record is validated first."
      >
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Import JSON file"
          onChange={(e) => void onImport(e.target.files?.[0])}
        />
        <Button variant="outline" disabled={!canSettings} onClick={() => fileRef.current?.click()}>
          <Upload aria-hidden="true" /> Import JSON
        </Button>
      </SectionCard>
    </div>
  );
}
