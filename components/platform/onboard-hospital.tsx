"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Building2, CheckCircle2, ExternalLink } from "lucide-react";
import { CheckboxField, NumberField, SelectField, TextField } from "@/components/forms/fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { BrandFields, CopyHospitalLink } from "@/components/admin/branding-panel";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { APP_CONFIG } from "@/lib/config";
import { NIGERIAN_BANKS, Plan, PLANS, type Tenant } from "@/lib/schemas/platform";
import { onboardSchema, RESERVED_SLUGS, usePlatformStore, type OnboardInput } from "@/lib/stores/platform";
import { slugify } from "@/lib/tenancy";
import { formatMoney } from "@/lib/utils/money";

export function OnboardHospital() {
  const run = useRunAction();
  const onboard = usePlatformStore((s) => s.onboard);
  const tenants = usePlatformStore((s) => s.tenants);
  const [created, setCreated] = useState<Tenant | null>(null);
  const [verifying, setVerifying] = useState(false);
  const form = useZodForm<OnboardInput>(onboardSchema, {
    name: "",
    shortName: "",
    tagline: "IVF & fertility care",
    primaryColor: "#1D4ED8",
    address: "",
    city: "Lagos",
    phone: "",
    email: "",
    slug: "",
    plan: "professional",
    feePercent: 1,
    feeCap: 0,
    aiEnabled: true,
    settlement: { bankName: "Guaranty Trust Bank", accountNumber: "", accountName: "" },
    dataMode: "sample",
    billingMonths: 1,
    admin: { name: "", email: "", phone: "" },
  });
  const values = form.watch();
  const hospitalName = values.name;

  // keep the link name and short name in step with the hospital name until the user edits them
  useEffect(() => {
    const words = (hospitalName ?? "").trim().split(/\s+/).filter(Boolean);
    if (!form.getFieldState("slug").isDirty) form.setValue("slug", slugify(words.slice(0, 2).join(" ")));
    if (!form.getFieldState("shortName").isDirty) form.setValue("shortName", words.slice(0, 2).join(" "));
  }, [hospitalName, form]);

  const slugTaken = values.slug && tenants.some((t) => t.slug === slugify(values.slug));
  const slugReserved = RESERVED_SLUGS.includes(slugify(values.slug ?? ""));

  if (created) {
    return (
      <>
        <PageHeader
          title="Hospital onboarded"
          crumbs={[{ label: "Hospitals", href: "/platform/hospitals" }, { label: created.name }]}
        />
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <CheckCircle2 className="text-success size-5" aria-hidden="true" /> {created.name} is live
            </span>
          }
          description="Send the hospital admin their link and sign-in details."
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs">Hospital link</dt>
              <dd>
                <CopyHospitalLink tenant={created} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Admin sign-in</dt>
              <dd>
                {created.admin.email} · temporary password <code>{APP_CONFIG.demoPassword}</code> · 2-step code{" "}
                <code>{APP_CONFIG.twoFactorCode}</code>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Paystack subaccount</dt>
              <dd className="font-mono text-xs">{created.subaccountCode}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Plan & fee</dt>
              <dd>
                {PLANS[created.plan].label} · {created.feePercent}% service charge · paid until {created.paidUntil}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <a href={`/h/${created.slug}`}>
                <ExternalLink aria-hidden="true" /> Open {created.shortName}
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/platform/hospitals/${created.slug}`}>Manage hospital</Link>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setCreated(null);
                form.reset();
              }}
            >
              Onboard another
            </Button>
          </div>
        </SectionCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Onboard a hospital"
        description="Creates the hospital's own branded workspace, its link, its Paystack subaccount and its first admin user."
        crumbs={[{ label: "Hospitals", href: "/platform/hospitals" }, { label: "Onboard" }]}
      />
      <Form {...form}>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit((v) => {
            const t = run(() => onboard(v), {
              success: (r) => `${r.name} onboarded`,
              setError: form.setError,
              allowReadOnly: true,
            });
            if (t) setCreated(t);
          })}
        >
          <SectionCard
            title="1. Hospital & branding"
            description="What staff see on their sign-in page, sidebar and printouts."
          >
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  control={form.control}
                  name="name"
                  label="Hospital name"
                  required
                  placeholder="e.g. Harmony Fertility Clinic"
                />
                <TextField control={form.control} name="shortName" label="Short name" required />
                <TextField control={form.control} name="tagline" label="Tagline" />
              </div>
              <BrandFields
                logo={values.logoDataUrl}
                color={values.primaryColor}
                onLogo={(d) => form.setValue("logoDataUrl", d)}
                onColor={(c) => form.setValue("primaryColor", c, { shouldValidate: true })}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField control={form.control} name="address" label="Address" required className="sm:col-span-2" />
                <TextField control={form.control} name="city" label="City" required />
                <TextField
                  control={form.control}
                  name="phone"
                  label="Phone"
                  type="tel"
                  required
                  placeholder="08031234567"
                />
                <TextField control={form.control} name="email" label="Email" type="email" required />
                <TextField
                  control={form.control}
                  name="slug"
                  label="Link name"
                  required
                  description={
                    slugTaken
                      ? "Already used by another hospital"
                      : slugReserved
                        ? "Reserved — choose another"
                        : `Link: /h/${slugify(values.slug ?? "") || "…"} (production: ${slugify(values.slug ?? "") || "…"}.overcare.ng)`
                  }
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="2. Plan, platform fee & AI" description="What the hospital pays you.">
            <div className="grid gap-4 sm:grid-cols-4">
              <SelectField
                control={form.control}
                name="plan"
                label="Plan"
                required
                options={Plan.options.map((p) => ({
                  value: p,
                  label: `${PLANS[p].label} — ${formatMoney(PLANS[p].monthly)}/mo`,
                }))}
              />
              <NumberField
                control={form.control}
                name="feePercent"
                label="Service charge on patient payments"
                suffix="%"
                step="0.05"
                min={0}
                max={10}
                required
              />
              <NumberField
                control={form.control}
                name="feeCap"
                label="Cap per payment (₦, 0 = none)"
                step="500"
                min={0}
              />
              <NumberField
                control={form.control}
                name="billingMonths"
                label="Months paid upfront"
                step="1"
                min={1}
                max={24}
                required
              />
              <CheckboxField
                control={form.control}
                name="aiEnabled"
                label="AI assistant enabled"
                className="sm:col-span-2"
              />
              <SelectField
                control={form.control}
                name="dataMode"
                label="Start with"
                required
                className="sm:col-span-2"
                options={[
                  { value: "sample", label: "Sample data (for demos and training)" },
                  { value: "empty", label: "An empty hospital (real onboarding)" },
                ]}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="3. Settlement account"
            description="Patient payments are split by Paystack: the hospital's share settles here next working day; your service charge settles to you."
          >
            <div className="grid gap-4 sm:grid-cols-4">
              <SelectField
                control={form.control}
                name="settlement.bankName"
                label="Bank"
                required
                options={NIGERIAN_BANKS.map((b) => ({ value: b, label: b }))}
              />
              <TextField
                control={form.control}
                name="settlement.accountNumber"
                label="Account number (NUBAN)"
                required
              />
              <TextField control={form.control} name="settlement.accountName" label="Account name" required disabled />
              <Button
                type="button"
                variant="outline"
                className="self-end"
                disabled={verifying || !/^\d{10}$/.test(values.settlement?.accountNumber ?? "")}
                onClick={() => {
                  setVerifying(true);
                  // demo stand-in for Paystack's "resolve account number" lookup
                  window.setTimeout(() => {
                    form.setValue("settlement.accountName", (values.name || "Hospital").toUpperCase().slice(0, 40), {
                      shouldValidate: true,
                    });
                    setVerifying(false);
                  }, 500);
                }}
              >
                <BadgeCheck aria-hidden="true" /> {verifying ? "Verifying…" : "Verify account"}
              </Button>
            </div>
          </SectionCard>

          <SectionCard
            title="4. Hospital administrator"
            description="The first user; they add the rest of their staff."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField control={form.control} name="admin.name" label="Full name" required />
              <TextField control={form.control} name="admin.email" label="Email" type="email" required />
              <TextField control={form.control} name="admin.phone" label="Mobile" type="tel" required />
            </div>
          </SectionCard>

          {Object.keys(form.formState.errors).length > 0 ? (
            <Alert variant="destructive">
              <Building2 aria-hidden="true" />
              <AlertTitle>Check the highlighted fields</AlertTitle>
              <AlertDescription>Some details are missing or invalid.</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button asChild variant="outline">
              <Link href="/platform/hospitals">Cancel</Link>
            </Button>
            <Button type="submit">Create hospital</Button>
          </div>
        </form>
      </Form>
    </>
  );
}
