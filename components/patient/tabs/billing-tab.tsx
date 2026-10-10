"use client";

import { AccountPanel } from "@/components/billing/account-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { identifiersFor, type PatientCtx } from "@/components/patient/types";

export function BillingTab({ ctx }: { ctx: PatientCtx }) {
  if (!ctx.episode) return <EmptyState title="No episode" description="Charges are raised against an episode." />;
  return (
    <SectionCard
      title={`Account — ${ctx.episode.ivfNo}`}
      description="Charges from orders, payments, part-payments, deposits and refunds."
    >
      <AccountPanel episodeId={ctx.episode.id} identifiers={identifiersFor(ctx)} branchId={ctx.patient.branchId} />
    </SectionCard>
  );
}
