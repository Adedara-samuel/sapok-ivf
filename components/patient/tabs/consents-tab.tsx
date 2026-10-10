"use client";

import { useState } from "react";
import { FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConsentPrint } from "@/components/consent/consent-print";
import { ConsentSignDialog } from "@/components/consent/consent-sign-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip } from "@/components/shared/status-chip";
import { identifiersFor, type PatientCtx } from "@/components/patient/types";
import { usePermission } from "@/hooks/use-permission";
import type { ConsentTemplateConfig } from "@/lib/constants/clinical";
import { fullName } from "@/lib/schemas/person";
import { useConsentStore } from "@/lib/stores/consent";
import { useSettingsStore } from "@/lib/stores/settings";
import { formatDate, shiftDate, todayIso } from "@/lib/utils/dates";

export function ConsentsTab({ ctx }: { ctx: PatientCtx }) {
  const ep = ctx.episode;
  const canSign = usePermission("consents.sign");
  const templates = useSettingsStore((s) => s.consentTemplates);
  const consents = useConsentStore((s) => s.consents);
  const [signing, setSigning] = useState<ConsentTemplateConfig | null>(null);
  if (!ep) return <EmptyState title="No episode" description="Open an episode first." />;
  const today = todayIso();
  const signer = `${fullName(ctx.patient)}${ctx.partner ? ` & ${fullName(ctx.partner)}` : ""}`;

  return (
    <SectionCard title="Consents" description="Sign on screen with a witness, print, and track expiry.">
      <ul className="grid gap-2">
        {templates.map((t) => {
          const signed = consents
            .filter((c) => c.episodeId === ep.id && c.template === t.id)
            .sort((a, b) => b.signedAt.localeCompare(a.signedAt));
          const latest = signed[0];
          const expired = latest?.expiresAt && latest.expiresAt < today;
          const expiring = latest?.expiresAt && !expired && latest.expiresAt <= shiftDate(today, 45);
          return (
            <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <FileSignature className="text-primary size-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {t.title} <span className="text-muted-foreground text-xs">{t.version}</span>
                </p>
                <p className="text-muted-foreground text-xs">
                  {latest
                    ? `Signed ${formatDate(latest.signedAt)} by ${latest.signerName}${latest.witnessName ? ` · witness ${latest.witnessName}` : ""}${latest.version !== t.version ? ` · older version ${latest.version}` : ""}`
                    : "Not signed"}
                </p>
              </div>
              {latest ? (
                expired ? (
                  <StatusChip status="expired" label={`Expired ${formatDate(latest.expiresAt)}`} />
                ) : expiring ? (
                  <StatusChip status="expiring" label={`Expires ${formatDate(latest.expiresAt)}`} />
                ) : (
                  <StatusChip
                    status="signed"
                    label={latest.expiresAt ? `Valid to ${formatDate(latest.expiresAt)}` : "Signed"}
                  />
                )
              ) : (
                <StatusChip status="pending" label="Unsigned" />
              )}
              <ConsentPrint
                template={t}
                consent={latest}
                identifiers={identifiersFor(ctx)}
                branchId={ctx.patient.branchId}
                label={latest ? "Print" : "Print blank"}
              />
              {canSign && ep.status !== "closed" ? (
                <Button size="sm" variant={latest && !expired ? "outline" : "default"} onClick={() => setSigning(t)}>
                  {latest ? (expired ? "Re-sign" : "Sign again") : "Sign"}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <ConsentSignDialog
        episodeId={ep.id}
        template={signing}
        defaultSigner={signer}
        open={signing !== null}
        onOpenChange={(o) => (!o ? setSigning(null) : undefined)}
      />
    </SectionCard>
  );
}
