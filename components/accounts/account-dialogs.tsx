"use client";

import { useState } from "react";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CheckboxField, NumberField, SelectField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PersonPicker } from "@/components/shared/person-picker";
import { SignaturePad } from "@/components/shared/signature-pad";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { fullName } from "@/lib/schemas/person";
import { RELATIONSHIPS, type Wallet } from "@/lib/schemas/wallet";
import { usePersonStore } from "@/lib/stores/person";
import { useSessionStore } from "@/lib/stores/session";
import {
  deskDepositSchema,
  openWalletSchema,
  useWalletStore,
  walletSettingsSchema,
  withdrawalSchema,
  type DeskDepositInput,
  type OpenWalletInput,
  type WalletSettingsInput,
  type WithdrawalInput,
} from "@/lib/stores/wallet";
import { newId } from "@/lib/utils/ids";
import { formatMoney } from "@/lib/utils/money";
import { walletOfPerson } from "@/lib/wallet/ledger";

type Relationship = (typeof RELATIONSHIPS)[number];

// ------------------------------------------------------------------ open account

export function OpenAccountDialog({
  open,
  onOpenChange,
  defaults,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaults?: Partial<Pick<OpenWalletInput, "kind" | "name" | "holderId" | "members">>;
  onCreated?: (w: Wallet) => void;
}) {
  const run = useRunAction();
  const openWallet = useWalletStore((s) => s.openWallet);
  const wallets = useWalletStore((s) => s.wallets);
  const persons = usePersonStore((s) => s.persons);
  const branchId = useSessionStore((s) => s.branchId);
  const form = useZodForm<OpenWalletInput>(openWalletSchema, {
    kind: defaults?.kind ?? "family",
    name: defaults?.name ?? "",
    holderId: defaults?.holderId ?? "",
    members: defaults?.members ?? [],
    bvn: "",
    generateAccount: true,
    autoDebit: true,
    lowBalanceAlert: 50_000,
  });
  const values = form.watch();
  const [pickerKey, setPickerKey] = useState(0);
  const linked = (id: string) => Boolean(walletOfPerson(wallets, id));
  const holder = persons.find((p) => p.id === values.holderId);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Open a patient or family account</DialogTitle>
          <DialogDescription>
            Money paid into the account number goes to the hospital&apos;s bank; bills for every member are deducted
            from the balance automatically.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              const w = run(() => openWallet(v, branchId), {
                success: (r) =>
                  r.virtualAccount
                    ? `${r.name} opened — account no. ${r.virtualAccount.accountNumber}`
                    : `${r.name} opened (account number pending BVN)`,
                setError: form.setError,
              });
              if (w) {
                close(false);
                onCreated?.(w);
              }
            })}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="kind"
                label="Account type"
                required
                options={[
                  { value: "family", label: "Family (couple, relatives, sponsor)" },
                  { value: "individual", label: "Individual (one patient)" },
                ]}
              />
              <TextField
                control={form.control}
                name="name"
                label="Account name"
                required
                placeholder="e.g. Adeyemi Family"
              />
              <FormField
                control={form.control}
                name="holderId"
                render={({ fieldState }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>
                      Account holder <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <PersonPicker
                        value={values.holderId}
                        roles={["patient", "partner"]}
                        invalid={Boolean(fieldState.error)}
                        filter={(p) => !linked(p.id)}
                        onChange={(p) => {
                          form.setValue("holderId", p.id, { shouldValidate: true });
                          if (!form.getValues("name"))
                            form.setValue("name", values.kind === "family" ? `${p.lastName} Family` : fullName(p));
                        }}
                      />
                    </FormControl>
                    <p className="text-muted-foreground text-xs">
                      The person responsible for paying; they receive a message for every deposit and deduction.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {values.kind === "family" ? (
              <div className="grid gap-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Other members ({values.members.length})</p>
                  <p className="text-muted-foreground text-xs">Link as many patients as the family pays for.</p>
                </div>
                {values.members.map((m, i) => {
                  const p = persons.find((x) => x.id === m.personId);
                  return (
                    <div key={m.personId} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {p ? `${fullName(p)} · ${p.prn}` : m.personId}
                      </span>
                      <Select
                        value={m.relationship}
                        onValueChange={(v) =>
                          form.setValue(
                            "members",
                            values.members.map((x, j) => (j === i ? { ...x, relationship: v as Relationship } : x)),
                          )
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          className="w-32"
                          aria-label={`Relationship of ${p?.firstName ?? "member"}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RELATIONSHIPS.filter((r) => r !== "Self").map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${p?.firstName ?? "member"}`}
                        onClick={() =>
                          form.setValue(
                            "members",
                            values.members.filter((_, j) => j !== i),
                          )
                        }
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2">
                  <Plus className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                  <PersonPicker
                    key={pickerKey}
                    roles={["patient", "partner"]}
                    placeholder="Add a member by name, PRN or phone…"
                    filter={(p) =>
                      !linked(p.id) && p.id !== values.holderId && !values.members.some((m) => m.personId === p.id)
                    }
                    onChange={(p) => {
                      const relationship: Relationship =
                        holder && p.lastName === holder.lastName ? (p.sex === "F" ? "Wife" : "Husband") : "Relative";
                      form.setValue("members", [...values.members, { personId: p.id, relationship }], {
                        shouldValidate: true,
                      });
                      setPickerKey((k) => k + 1);
                    }}
                  />
                </div>
                <FormField control={form.control} name="members" render={() => <FormMessage />} />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <CheckboxField
                control={form.control}
                name="generateAccount"
                label="Issue a dedicated account number now (Paystack)"
                description="The family pays by transfer from any bank app; the money is matched to this account automatically."
              />
              {values.generateAccount ? (
                <TextField
                  control={form.control}
                  name="bvn"
                  label="Account holder's BVN"
                  required
                  placeholder="11 digits"
                  description="Required by the bank to issue the account number. Only the last 4 digits are kept."
                />
              ) : (
                <p className="text-muted-foreground self-center text-sm">
                  You can issue the account number later once the holder provides their BVN.
                </p>
              )}
              <CheckboxField
                control={form.control}
                name="autoDebit"
                label="Auto-debit bills from this account"
                description="Charges for any member are paid from the balance as soon as they are raised."
              />
              <NumberField
                control={form.control}
                name="lowBalanceAlert"
                label="Low-balance alert (₦)"
                step="1000"
                min={0}
                description="The holder and accountants are told when the balance drops below this."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit">Open account</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ link member

export function AddMemberDialog({
  wallet,
  open,
  onOpenChange,
}: {
  wallet: Wallet;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const run = useRunAction();
  const addMember = useWalletStore((s) => s.addMember);
  const wallets = useWalletStore((s) => s.wallets);
  const [personId, setPersonId] = useState("");
  const [relationship, setRelationship] = useState<Relationship>("Relative");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setPersonId("");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link a patient to {wallet.name}</DialogTitle>
          <DialogDescription>
            Their bills will be paid from this account. A person can belong to one account at a time.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="member-person">Patient</Label>
            <PersonPicker
              id="member-person"
              value={personId}
              roles={["patient", "partner"]}
              filter={(p) => !walletOfPerson(wallets, p.id)}
              onChange={(p) => setPersonId(p.id)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="member-rel">Relationship to the holder</Label>
            <Select value={relationship} onValueChange={(v) => setRelationship(v as Relationship)}>
              <SelectTrigger id="member-rel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.filter((r) => r !== "Self").map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!personId}
            onClick={() => {
              if (run(() => addMember(wallet.id, personId, relationship), { success: "Member linked" })) {
                setPersonId("");
                onOpenChange(false);
              }
            }}
          >
            Link member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ desk deposit

export function DeskDepositDialog({
  wallet,
  open,
  onOpenChange,
}: {
  wallet: Wallet;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const run = useRunAction();
  const deposit = useWalletStore((s) => s.recordDeskDeposit);
  const form = useZodForm<DeskDepositInput>(deskDepositSchema, { channel: "cash", reference: "" });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) form.reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a deposit at the desk</DialogTitle>
          <DialogDescription>
            Cash or POS paid at the hospital into {wallet.name}. Transfers to the account number are credited
            automatically and don&apos;t need recording.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              if (
                run(() => deposit(wallet.id, v), {
                  success: (e) => `${formatMoney(e.amount)} deposited — balance ${formatMoney(e.balanceAfter)}`,
                  setError: form.setError,
                })
              ) {
                form.reset();
                onOpenChange(false);
              }
            })}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField control={form.control} name="amount" label="Amount (₦)" step="1000" min={1} required />
              <SelectField
                control={form.control}
                name="channel"
                label="Paid by"
                required
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "pos", label: "POS" },
                ]}
              />
            </div>
            <TextField control={form.control} name="reference" label="POS slip reference" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Record deposit</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ simulated gateway transfer

const simulateSchema = z.object({
  amount: z.number({ error: "Enter an amount" }).positive("Enter an amount greater than zero").max(50_000_000),
  channel: z.enum(["bank-transfer", "card"]),
  senderName: z.string().trim().min(3, "Enter the sender's name"),
  senderBank: z.string().optional(),
});
type SimulateInput = z.infer<typeof simulateSchema>;

/**
 * Demo stand-in for Paystack's webhook: what happens when the family transfers money to their account number.
 * Sends the exact payload shape the real webhook handler will receive, including a unique reference.
 */
export function SimulateTransferDialog({
  wallet,
  open,
  onOpenChange,
}: {
  wallet: Wallet;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const run = useRunAction();
  const receive = useWalletStore((s) => s.receiveGatewayPayment);
  const holder = usePersonStore((s) => s.persons.find((p) => p.id === wallet.holderId));
  const [lastRef, setLastRef] = useState<string | null>(null);
  const [lastInput, setLastInput] = useState<SimulateInput | null>(null);
  const form = useZodForm<SimulateInput>(simulateSchema, {
    channel: "bank-transfer",
    senderName: holder ? fullName(holder) : "",
    senderBank: "GTBank",
  });
  const send = (v: SimulateInput, reference: string) =>
    run(
      () =>
        receive({
          accountNumber: wallet.virtualAccount?.accountNumber ?? "",
          amount: v.amount,
          channel: v.channel,
          senderName: v.senderName,
          senderBank: v.senderBank,
          reference,
        }),
      {
        success: (r) =>
          r.status === "duplicate"
            ? `Duplicate notification ${reference} ignored — nothing credited twice`
            : `${formatMoney(v.amount)} received — balance ${formatMoney(r.entry.balanceAfter)}`,
      },
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Simulate a payment to the account number</DialogTitle>
          <DialogDescription>
            Demo only: plays the part of the bank and Paystack. In production this happens when the family transfers to{" "}
            {wallet.virtualAccount?.bankName} {wallet.virtualAccount?.accountNumber}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              const reference = newId(v.channel === "card" ? "PSK_CRD" : "PSK_TRF").toUpperCase();
              if (send(v, reference)) {
                setLastRef(reference);
                setLastInput(v);
              }
            })}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField control={form.control} name="amount" label="Amount (₦)" step="1000" min={1} required />
              <SelectField
                control={form.control}
                name="channel"
                label="Paid by"
                required
                options={[
                  { value: "bank-transfer", label: "Bank transfer" },
                  { value: "card", label: "Card (Paystack checkout)" },
                ]}
              />
              <TextField control={form.control} name="senderName" label="Sender's name" required />
              <TextField control={form.control} name="senderBank" label="Sender's bank" />
            </div>
            {lastRef && lastInput ? (
              <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-sm">
                <span>
                  Last reference: <code className="text-xs">{lastRef}</code>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    send(lastInput, lastRef);
                    toast.info("Gateways sometimes send the same notification twice — it is detected and ignored.");
                  }}
                >
                  Re-send same notification
                </Button>
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button type="submit">Send payment</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ settings

export function AccountSettingsDialog({
  wallet,
  open,
  onOpenChange,
}: {
  wallet: Wallet;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const run = useRunAction();
  const update = useWalletStore((s) => s.updateSettings);
  const form = useZodForm<WalletSettingsInput>(walletSettingsSchema, {
    name: wallet.name,
    autoDebit: wallet.autoDebit,
    lowBalanceAlert: wallet.lowBalanceAlert,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Account settings</DialogTitle>
          <DialogDescription>{wallet.code}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              if (run(() => update(wallet.id, v), { success: "Account updated", setError: form.setError }))
                onOpenChange(false);
            })}
          >
            <TextField control={form.control} name="name" label="Account name" required />
            <CheckboxField
              control={form.control}
              name="autoDebit"
              label="Auto-debit bills from this account"
              description="When off, charges wait until staff choose “Pay outstanding now”."
            />
            <NumberField
              control={form.control}
              name="lowBalanceAlert"
              label="Low-balance alert (₦)"
              step="1000"
              min={0}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const creditSchema = z.object({
  creditLimit: z.number({ error: "Enter an amount" }).min(0, "Cannot be negative"),
  reason: z.string().trim().min(5, "Give a reason (at least 5 characters)"),
});
type CreditInput = z.infer<typeof creditSchema>;

export function CreditLimitDialog({
  wallet,
  open,
  onOpenChange,
}: {
  wallet: Wallet;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const run = useRunAction();
  const setLimit = useWalletStore((s) => s.setCreditLimit);
  const form = useZodForm<CreditInput>(creditSchema, { creditLimit: wallet.creditLimit, reason: "" });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Credit limit for {wallet.name}</DialogTitle>
          <DialogDescription>
            How far below ₦0 this account may go while treatment continues. Approved by a hospital admin and recorded in
            the audit trail.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              if (
                run(() => setLimit(wallet.id, v.creditLimit, v.reason), {
                  success: `Credit limit set to ${formatMoney(v.creditLimit)}`,
                  setError: form.setError,
                })
              ) {
                form.reset({ creditLimit: v.creditLimit, reason: "" });
                onOpenChange(false);
              }
            })}
          >
            <NumberField
              control={form.control}
              name="creditLimit"
              label="Credit limit (₦)"
              step="10000"
              min={0}
              required
            />
            <TextField
              control={form.control}
              name="reason"
              label="Reason"
              required
              placeholder="e.g. Approved by MD for OCR this week"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Approve limit</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ issue account number

export function IssueAccountDialog({
  wallet,
  open,
  onOpenChange,
}: {
  wallet: Wallet;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const run = useRunAction();
  const issue = useWalletStore((s) => s.issueAccountNumber);
  const [bvn, setBvn] = useState("");
  const valid = /^\d{11}$/.test(bvn);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue an account number</DialogTitle>
          <DialogDescription>
            Paystack needs the account holder&apos;s BVN (Bank Verification Number) to create a dedicated account. The
            hospital keeps only the last 4 digits.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="issue-bvn">Holder&apos;s BVN</Label>
          <input
            id="issue-bvn"
            inputMode="numeric"
            maxLength={11}
            value={bvn}
            onChange={(e) => setBvn(e.target.value.replace(/\D/g, ""))}
            className="border-input bg-background h-9 rounded-md border px-3 text-sm tabular-nums"
            aria-invalid={bvn.length > 0 && !valid}
          />
          <p className="text-muted-foreground text-xs">{bvn.length}/11 digits</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              if (
                run(() => issue(wallet.id, bvn), {
                  success: (w) => `Account number ${w.virtualAccount?.accountNumber} issued`,
                })
              ) {
                setBvn("");
                onOpenChange(false);
              }
            }}
          >
            Issue account number
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ auto-debit consent

export function ConsentDialog({
  wallet,
  open,
  onOpenChange,
}: {
  wallet: Wallet;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const run = useRunAction();
  const sign = useWalletStore((s) => s.signConsent);
  const holder = usePersonStore((s) => s.persons.find((p) => p.id === wallet.holderId));
  const [signature, setSignature] = useState("");
  const [name, setName] = useState(holder ? fullName(holder) : "");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Auto-debit authorisation</DialogTitle>
          <DialogDescription>Signed once by the account holder.</DialogDescription>
        </DialogHeader>
        <p className="bg-muted/50 rounded-lg p-3 text-sm leading-relaxed">
          I, the holder of <strong>{wallet.name}</strong> ({wallet.code}), authorise the hospital to deduct the cost of
          treatment, drugs, tests and services for every member of this account from its balance as they are billed. I
          will receive a message for every deduction, can request a statement at any time, and can ask for any unspent
          balance to be refunded.
        </p>
        <div className="grid gap-1.5">
          <Label htmlFor="consent-name">Full name of signer</Label>
          <input
            id="consent-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          />
        </div>
        <SignaturePad onChange={setSignature} label="Holder's signature" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!signature || name.trim().length < 3}
            onClick={() => {
              if (
                run(() => sign(wallet.id, { signerName: name.trim(), signatureDataUrl: signature }), {
                  success: "Authorisation signed and stored",
                })
              )
                onOpenChange(false);
            }}
          >
            Save signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ refund of unspent balance

export function WithdrawalDialog({
  wallet,
  refundable,
  open,
  onOpenChange,
}: {
  wallet: Wallet;
  refundable: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const run = useRunAction();
  const request = useWalletStore((s) => s.requestWithdrawal);
  const form = useZodForm<WithdrawalInput>(withdrawalSchema, { reason: "", bankName: "", accountNumber: "" });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) form.reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund unspent balance</DialogTitle>
          <DialogDescription>
            Goes to a manager for approval (nobody approves their own request). Up to{" "}
            {formatMoney(Math.max(0, refundable))} can be refunded.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              if (
                run(() => request(wallet.id, v), {
                  success: "Refund sent for approval",
                  setError: form.setError,
                })
              ) {
                form.reset();
                onOpenChange(false);
              }
            })}
          >
            <NumberField control={form.control} name="amount" label="Amount (₦)" step="1000" min={1} required />
            <TextField
              control={form.control}
              name="reason"
              label="Reason"
              required
              placeholder="e.g. Treatment completed"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="bankName" label="Pay to bank" required />
              <TextField control={form.control} name="accountNumber" label="Account number" required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Submit for approval</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
