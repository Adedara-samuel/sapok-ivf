"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Droplet, HeartHandshake, Phone, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusChip, humanize } from "@/components/shared/status-chip";
import type { PatientCtx } from "@/components/patient/types";
import { useLookups } from "@/hooks/use-lookups";
import { usePermission } from "@/hooks/use-permission";
import { EPISODE_TYPE_LABELS } from "@/lib/constants/clinical";
import { accountSummary, useBillingStore } from "@/lib/stores/billing";
import { useWalletStore } from "@/lib/stores/wallet";
import { cn } from "@/lib/utils/cn";
import { formatAge } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { walletBalance, walletForEpisode, walletOfPerson } from "@/lib/wallet/ledger";

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{label}</dt>
      <dd className="truncate text-sm">{children}</dd>
    </div>
  );
}

export function PatientHeader({ ctx, onEpisodeChange }: { ctx: PatientCtx; onEpisodeChange: (id: string) => void }) {
  const { patient: p, partner, episode } = ctx;
  const { staffName } = useLookups();
  const canBilling = usePermission("billing.view");
  const charges = useBillingStore((s) => s.charges);
  const payments = useBillingStore((s) => s.payments);
  const refunds = useBillingStore((s) => s.refunds);
  const balance = useMemo(
    () => (episode ? accountSummary(episode.id, charges, payments, refunds).balance : 0),
    [episode, charges, payments, refunds],
  );
  const sponsor = p.payer.sponsor ?? p.payer.company;
  const canWallets = usePermission("wallets.view");
  const wallets = useWalletStore((s) => s.wallets);
  const entries = useWalletStore((s) => s.entries);
  const wallet = episode ? walletForEpisode(wallets, episode) : walletOfPerson(wallets, p.id);
  const walletAvailable = wallet ? walletBalance(entries, wallet.id) + wallet.creditLimit : 0;

  return (
    <section
      className="bg-card sticky top-14 z-20 -mx-4 mb-4 border-b px-4 py-4 shadow-sm md:-mx-6 md:px-6"
      aria-label="Patient summary"
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="bg-muted flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
          {p.photoUrl ? (
            <img src={p.photoUrl} alt={`Photo of ${p.firstName} ${p.lastName}`} className="size-full object-cover" />
          ) : (
            <UserRound className="text-muted-foreground size-7" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">
              {p.title} {p.firstName} {p.otherNames ? `${p.otherNames} ` : ""}
              {p.lastName}
            </h1>
            {partner ? (
              <Badge variant="outline" className="gap-1">
                <HeartHandshake className="text-rose size-3" aria-hidden="true" /> Couple with {partner.firstName}{" "}
                {partner.lastName}
              </Badge>
            ) : null}
            {episode ? (
              <StatusChip status={episode.status} label={`Episode ${humanize(episode.status)}`} />
            ) : (
              <StatusChip status="registered" label="No episode" />
            )}
            {p.allergies.map((a) => (
              <Badge key={a} variant="destructive" className="gap-1">
                <AlertTriangle className="size-3" aria-hidden="true" /> Allergy: {a}
              </Badge>
            ))}
            {p.bloodGroup ? (
              <Badge variant="outline" className="gap-1">
                <Droplet className="text-rose size-3" aria-hidden="true" /> {p.bloodGroup}
                {p.genotype ? ` · ${p.genotype}` : ""}
              </Badge>
            ) : null}
            {canBilling && episode ? (
              <Badge variant={balance > 0 ? "destructive" : "secondary"} className="tabular-nums">
                {balance > 0
                  ? `Outstanding ${formatMoney(balance)}`
                  : balance < 0
                    ? `Credit ${formatMoney(-balance)}`
                    : "Account settled"}
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {p.prn}
            {episode ? ` · ${episode.ivfNo} · ${EPISODE_TYPE_LABELS[episode.type]}` : ""} · {formatAge(p.dob, true)} ·{" "}
            {humanize(p.maritalStatus)}
          </p>
        </div>
        {ctx.episodes.length > 1 && episode ? (
          <Select value={episode.id} onValueChange={onEpisodeChange}>
            <SelectTrigger size="sm" className="w-56" aria-label="Switch episode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ctx.episodes.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.ivfNo} · {EPISODE_TYPE_LABELS[e.type]} ({e.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <Item label="Mobile">
          <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 hover:underline">
            <Phone className="size-3" aria-hidden="true" />
            {p.phone}
          </a>
        </Item>
        <Item label="Email">{p.email || "—"}</Item>
        <Item label="Partner">
          {partner ? `${partner.firstName} ${partner.lastName} (${formatAge(partner.dob)})` : "—"}
        </Item>
        <Item label="Next of kin">
          {p.nextOfKin.name} · {p.nextOfKin.relationship} · {p.nextOfKin.phone}
        </Item>
        <Item label="Payer / category">
          {humanize(p.payer.category)}
          {sponsor ? ` · ${sponsor}` : ""}
        </Item>
        <Item label="Doctor">{episode ? staffName(episode.doctorId) : "—"}</Item>
        {canWallets ? (
          <Item label="Paying account">
            {wallet ? (
              <Link href={`/accounts/${wallet.id}`} className="hover:underline">
                {wallet.name} ·{" "}
                <span className={cn("tabular-nums", walletAvailable <= 0 && "text-destructive")}>
                  {formatMoney(walletAvailable)}
                </span>
              </Link>
            ) : (
              <Link href="?tab=billing" className="text-muted-foreground hover:underline">
                None — open one
              </Link>
            )}
          </Item>
        ) : null}
      </dl>
    </section>
  );
}
