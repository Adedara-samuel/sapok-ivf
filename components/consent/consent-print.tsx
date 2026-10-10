"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintDialog } from "@/components/print/print-dialog";
import { PrintSection, PrintSheet, type PrintIdentifier } from "@/components/print/print-sheet";
import type { ConsentTemplateConfig } from "@/lib/constants/clinical";
import type { Consent } from "@/lib/schemas/admin";
import { formatDate, formatDateTime } from "@/lib/utils/dates";

/** Printable consent form — signed copy if `consent` is given, otherwise a blank form for wet signature. */
export function ConsentPrint({
  template,
  consent,
  identifiers,
  branchId,
  label = "Print",
}: {
  template: ConsentTemplateConfig;
  consent?: Consent;
  identifiers: PrintIdentifier[];
  branchId: string;
  label?: string;
}) {
  return (
    <PrintDialog
      title={`${template.title} (${template.version})`}
      documentTitle={`consent-${template.id}`}
      auditEntity="consent"
      auditId={consent?.id}
      trigger={
        <Button size="sm" variant="ghost">
          <Printer aria-hidden="true" /> {label}
        </Button>
      }
    >
      {(ref) => (
        <PrintSheet ref={ref} title={template.title} identifiers={identifiers} branchId={branchId}>
          <PrintSection title={`Consent form ${template.version}`}>
            <p className="leading-relaxed">{template.body}</p>
          </PrintSection>
          <PrintSection title="Signatures">
            {consent ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <img src={consent.signatureDataUrl} alt="Signature" className="h-16" />
                  <p>
                    {consent.signerName} · {formatDateTime(consent.signedAt)}
                  </p>
                </div>
                <div>
                  <p className="mt-10 border-t pt-1">Witness: {consent.witnessName ?? "—"}</p>
                  {consent.expiresAt ? <p>Valid until {formatDate(consent.expiresAt)}</p> : null}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-8 pt-10">
                <p className="border-t pt-1">Patient / couple signature &amp; date</p>
                <p className="border-t pt-1">Witness signature &amp; date</p>
              </div>
            )}
          </PrintSection>
        </PrintSheet>
      )}
    </PrintDialog>
  );
}
