"use client";

import { useState } from "react";
import Link from "next/link";
import { Link2, Plus, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OpenAccountDialog } from "@/components/accounts/account-dialogs";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip } from "@/components/shared/status-chip";
import type { PatientCtx } from "@/components/patient/types";
import { useCan } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { useWalletStore } from "@/lib/stores/wallet";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { walletBalance, walletForEpisode, walletOfPerson } from "@/lib/wallet/ledger";

/** The account that pays this couple's bills, or a way to create / link one. */
export function PatientAccountCard({ ctx }: { ctx: PatientCtx }) {
  const can = useCan();
  const run = useRunAction();
  const wallets = useWalletStore((s) => s.wallets);
  const entries = useWalletStore((s) => s.entries);
  const addMember = useWalletStore((s) => s.addMember);
  const [openNew, setOpenNew] = useState(false);
  const [linkTo, setLinkTo] = useState("");
  if (!can("wallets.view")) return null;

  const { patient, partner, episode } = ctx;
  const wallet = episode ? walletForEpisode(wallets, episode) : walletOfPerson(wallets, patient.id);
  const patientLinked = Boolean(walletOfPerson(wallets, patient.id));

  if (wallet) {
    const balance = walletBalance(entries, wallet.id);
    const available = balance + wallet.creditLimit;
    return (
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <WalletCards className="text-primary size-4" aria-hidden="true" /> Paid from {wallet.name}
          </span>
        }
        description={`${wallet.code} · ${wallet.members.length} member(s) · auto-debit ${wallet.autoDebit ? "on: bills are deducted as they are raised" : "off"}`}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href={`/accounts/${wallet.id}`}>Open account</Link>
          </Button>
        }
      >
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-muted-foreground text-xs">Available balance</p>
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                balance < 0
                  ? "text-destructive"
                  : wallet.lowBalanceAlert && balance < wallet.lowBalanceAlert
                    ? "text-warning"
                    : "text-success",
              )}
              data-testid="patient-wallet-balance"
            >
              {formatMoney(available)}
            </p>
            {wallet.creditLimit ? (
              <p className="text-muted-foreground text-xs">
                Balance {formatMoney(balance)} · credit limit {formatMoney(wallet.creditLimit)}
              </p>
            ) : null}
          </div>
          {wallet.virtualAccount ? (
            <div>
              <p className="text-muted-foreground text-xs">Account number</p>
              <p className="font-semibold tabular-nums">
                {wallet.virtualAccount.accountNumber}{" "}
                <span className="text-muted-foreground text-xs font-normal">{wallet.virtualAccount.bankName}</span>
              </p>
            </div>
          ) : (
            <StatusChip status="pending" label="Account number needs the holder's BVN" />
          )}
          {!patientLinked && episode ? (
            <p className="text-muted-foreground text-xs">Paid through the partner&apos;s account.</p>
          ) : null}
        </div>
      </SectionCard>
    );
  }

  const families = wallets.filter((w) => w.kind === "family" && w.status === "active");
  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <WalletCards className="text-muted-foreground size-4" aria-hidden="true" /> No patient account yet
        </span>
      }
      description="Give this patient (or the couple) an account number so payments are matched and bills are deducted automatically."
    >
      {can("wallets.manage") ? (
        <div className="flex flex-wrap items-end gap-3">
          <Button onClick={() => setOpenNew(true)}>
            <Plus aria-hidden="true" /> {partner ? "Open family account for the couple" : "Open account"}
          </Button>
          {families.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="grid gap-1">
                <Label htmlFor="link-family" className="text-xs">
                  Or link to an existing family account
                </Label>
                <Select value={linkTo} onValueChange={setLinkTo}>
                  <SelectTrigger id="link-family" className="w-64">
                    <SelectValue placeholder="Choose a family account…" />
                  </SelectTrigger>
                  <SelectContent>
                    {families.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                disabled={!linkTo}
                onClick={() =>
                  run(
                    () => {
                      addMember(linkTo, patient.id, "Relative");
                      if (partner && !walletOfPerson(useWalletStore.getState().wallets, partner.id))
                        addMember(linkTo, partner.id, "Relative");
                      return true;
                    },
                    { success: "Linked to the family account" },
                  )
                }
              >
                <Link2 aria-hidden="true" /> Link
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Ask the front desk or accounts to open one.</p>
      )}
      <OpenAccountDialog
        open={openNew}
        onOpenChange={setOpenNew}
        defaults={{
          kind: partner ? "family" : "individual",
          name: partner ? `${patient.lastName} Family` : `${patient.firstName} ${patient.lastName}`,
          holderId: patient.id,
          members:
            partner && !walletOfPerson(wallets, partner.id) ? [{ personId: partner.id, relationship: "Husband" }] : [],
        }}
      />
    </SectionCard>
  );
}
