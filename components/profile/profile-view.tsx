"use client";

import { useMemo, useState } from "react";
import { Check, Circle, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { TextField } from "@/components/forms/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip, humanize } from "@/components/shared/status-chip";
import { useZodForm } from "@/hooks/use-zod-form";
import { CAPABILITY_GROUPS, ROLE_LABELS } from "@/lib/permissions";
import { changeOwnPassword, changePasswordSchema, PASSWORD_RULES, type ChangePasswordInput } from "@/lib/services/auth";
import { useAuditStore } from "@/lib/stores/audit";
import { isDomainError } from "@/lib/stores/core";
import { useCredentialStore } from "@/lib/stores/credentials";
import { useSessionStore } from "@/lib/stores/session";
import { useSettingsStore } from "@/lib/stores/settings";
import { useStaffStore } from "@/lib/stores/staff";
import { formatDateTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function ChangePasswordCard({ staffId }: { staffId: string }) {
  const credential = useCredentialStore((s) => s.credentials[staffId]);
  const [saving, setSaving] = useState(false);
  const form = useZodForm<ChangePasswordInput>(changePasswordSchema, { next: "", confirm: "" });
  const next = form.watch("next");

  const onSubmit = async (values: ChangePasswordInput) => {
    setSaving(true);
    try {
      await changeOwnPassword(values);
      form.reset({ next: "", confirm: "" });
      toast.success("Password changed. Use your new password next time you sign in.");
    } catch (e) {
      if (isDomainError(e)) {
        Object.entries(e.fieldErrors).forEach(([field, message]) =>
          form.setError(field as keyof ChangePasswordInput, { message }),
        );
        toast.error(e.message);
      } else toast.error("Could not change the password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <KeyRound className="text-primary size-4" aria-hidden="true" /> Change password
        </span>
      }
      description={
        credential
          ? `Last changed ${formatDateTime(credential.changedAt)}`
          : "You are using the demo password. Choose a personal one."
      }
    >
      <Form {...form}>
        <form noValidate className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <TextField
            control={form.control}
            name="next"
            label="New password"
            type="password"
            autoComplete="new-password"
            required
          />
          <ul className="grid gap-1 text-xs sm:grid-cols-2" aria-label="Password requirements">
            {PASSWORD_RULES.map((r) => {
              const ok = r.test(next);
              return (
                <li
                  key={r.id}
                  className={cn("flex items-center gap-1.5", ok ? "text-success" : "text-muted-foreground")}
                >
                  {ok ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Circle className="size-3" aria-hidden="true" />
                  )}
                  {r.label}
                  <span className="sr-only">{ok ? "(met)" : "(not met)"}</span>
                </li>
              );
            })}
          </ul>
          <TextField
            control={form.control}
            name="confirm"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
          />
          <Button type="submit" className="w-fit" disabled={saving}>
            {saving ? "Saving…" : "Update password"}
          </Button>
        </form>
      </Form>
    </SectionCard>
  );
}

export function ProfileView() {
  const userId = useSessionStore((s) => s.userId);
  const sessionRole = useSessionStore((s) => s.role);
  const me = useStaffStore((s) => s.staff.find((x) => x.id === userId));
  const branches = useSettingsStore((s) => s.branches);
  const matrix = useSettingsStore((s) => s.matrix);
  const events = useAuditStore((s) => s.events);
  const recent = useMemo(
    () =>
      events
        .filter((e) => e.actorId === userId)
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 12),
    [events, userId],
  );

  if (!me || !userId) return <EmptyState title="Not signed in" description="Sign in to see your profile." />;
  const role = sessionRole ?? me.role;
  const caps = new Set(matrix[role]);
  const initials = me.name
    .replace(/^Dr\.\s*/, "")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  return (
    <>
      <PageHeader
        title="My profile"
        description="Your account details, access and security."
        crumbs={[{ label: "Account" }, { label: "My profile" }]}
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="grid content-start gap-4 lg:col-span-3">
          <SectionCard
            title="Account details"
            description={
              <span className="flex items-center gap-1.5">
                <Lock className="size-3.5" aria-hidden="true" /> Read-only. Ask an administrator or HR to change these
                details.
              </span>
            }
          >
            <div className="mb-5 flex items-center gap-4">
              <span className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-full text-lg font-semibold">
                {initials}
              </span>
              <div>
                <p className="text-lg font-semibold">{me.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{ROLE_LABELS[me.role]}</Badge>
                  <StatusChip
                    status={me.active ? "approved" : "cancelled"}
                    label={me.active ? "Active" : "Deactivated"}
                  />
                  {sessionRole && sessionRole !== me.role ? (
                    <Badge variant="outline">Viewing as {ROLE_LABELS[sessionRole]} (demo)</Badge>
                  ) : null}
                </div>
              </div>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Staff ID" value={me.id} />
              <Detail label="Role" value={ROLE_LABELS[me.role]} />
              <Detail label="Email" value={me.email} />
              <Detail label="Phone" value={me.phone} />
              <Detail label="Branch" value={branches.find((b) => b.id === me.branchId)?.name ?? me.branchId} />
              <Detail label="Position / note" value={me.note ?? "—"} />
            </dl>
          </SectionCard>

          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <ShieldCheck className="text-primary size-4" aria-hidden="true" /> What you can do
              </span>
            }
            description={`${caps.size} permission(s) for the ${ROLE_LABELS[role]} role`}
          >
            <div className="grid gap-4">
              {CAPABILITY_GROUPS.map((g) => {
                const mine = g.items.filter((c) => caps.has(c));
                if (mine.length === 0) return null;
                return (
                  <div key={g.label}>
                    <p className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase">
                      {g.label}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {mine.map((c) => (
                        <Badge key={c} variant="outline" className="font-normal">
                          {humanize(c.replace(".", " — "))}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

        <div className="grid content-start gap-4 lg:col-span-2">
          <ChangePasswordCard staffId={me.id} />
          <SectionCard title="My recent activity">
            {recent.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              <ul className="grid gap-2">
                {recent.map((e) => (
                  <li key={e.id} className="rounded-md border p-2 text-sm">
                    <span className="block">{e.summary}</span>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(e.at)} · {humanize(e.action)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}
