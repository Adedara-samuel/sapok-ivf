"use client";

import { PatientAccountCard } from "@/components/accounts/patient-account-card";
import { AccountPanel } from "@/components/billing/account-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { identifiersFor, type PatientCtx } from "@/components/patient/types";

export function BillingTab({ ctx }: { ctx: PatientCtx }) {
  return (
    <div className="grid gap-4">
      <PatientAccountCard ctx={ctx} />
      {!ctx.episode ? (
        <EmptyState title="No episode" description="Charges are raised against an episode." />
      ) : (
        <SectionCard
          title={`Charges & payments — ${ctx.episode.ivfNo}`}
          description="Charges from orders, payments (including automatic account deductions), deposits and refunds."
        >
          <AccountPanel episodeId={ctx.episode.id} identifiers={identifiersFor(ctx)} branchId={ctx.patient.branchId} />
        </SectionCard>
      )}
    </div>
  );
}
