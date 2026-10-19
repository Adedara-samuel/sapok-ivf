"use client";

import { Copy, ImageUp, Landmark, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/shared/section-card";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { useActiveTenant } from "@/hooks/use-tenant";
import { useZodForm } from "@/hooks/use-zod-form";
import { brandingSchema, type Branding, type Tenant } from "@/lib/schemas/platform";
import { applyTenant } from "@/lib/stores";
import { audit } from "@/lib/stores/audit";
import { usePlatformStore } from "@/lib/stores/platform";
import { useSessionStore } from "@/lib/stores/session";
import { useStaffStore } from "@/lib/stores/staff";
import { formatMoney } from "@/lib/utils/money";

export const BRAND_SWATCHES = ["#0F766E", "#6D28D9", "#BE185D", "#1D4ED8", "#B45309", "#15803D", "#0E7490", "#9F1239"];
const MAX_LOGO_KB = 300;

/** Reads an image file as a data URL, rejecting anything too large for the demo's storage. */
export function readLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(file.type)) {
      reject(new Error("Use a PNG, JPG, SVG or WebP image"));
      return;
    }
    if (file.size > MAX_LOGO_KB * 1024) {
      reject(new Error(`Logo must be under ${MAX_LOGO_KB} KB`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

/** Logo upload + colour picker shared by the hospital admin and the super-admin console. */
export function BrandFields({
  logo,
  color,
  onLogo,
  onColor,
  disabled,
}: {
  logo?: string;
  color: string;
  onLogo: (dataUrl: string | undefined) => void;
  onColor: (hex: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="brand-logo">Logo</Label>
        <div className="flex items-center gap-3">
          <span className="bg-muted flex size-16 items-center justify-center overflow-hidden rounded-xl border">
            {logo ? (
              <img src={logo} alt="Logo preview" className="size-full object-contain" />
            ) : (
              <ImageUp className="text-muted-foreground size-6" aria-hidden="true" />
            )}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={disabled} asChild>
              <label htmlFor="brand-logo" className="cursor-pointer">
                <ImageUp aria-hidden="true" /> {logo ? "Replace" : "Upload"}
              </label>
            </Button>
            {logo ? (
              <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onLogo(undefined)}>
                <Trash2 aria-hidden="true" /> Remove
              </Button>
            ) : null}
          </div>
          <input
            id="brand-logo"
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="sr-only"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              readLogo(file)
                .then(onLogo)
                .catch((err: Error) => toast.error(err.message));
            }}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          Square image, up to {MAX_LOGO_KB} KB. Shown on sign-in, sidebar and printouts.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="brand-color">Brand colour</Label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="brand-color"
            type="color"
            value={color}
            disabled={disabled}
            onChange={(e) => onColor(e.target.value.toUpperCase())}
            className="h-9 w-12 cursor-pointer rounded border"
          />
          {BRAND_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              disabled={disabled}
              onClick={() => onColor(c)}
              className="size-7 rounded-full border-2 border-white shadow ring-1 ring-black/10 aria-pressed:ring-2 aria-pressed:ring-black/60"
              style={{ background: c }}
              aria-label={`Use colour ${c}`}
              aria-pressed={color.toUpperCase() === c}
            />
          ))}
        </div>
        <p className="text-muted-foreground text-xs">Buttons, links and highlights use this colour.</p>
      </div>
    </div>
  );
}

function hospitalLink(slug: string): string {
  return typeof window === "undefined" ? `/h/${slug}` : `${window.location.origin}/h/${slug}`;
}

export function CopyHospitalLink({ tenant }: { tenant: Tenant }) {
  const link = hospitalLink(tenant.slug);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="bg-muted rounded px-2 py-1 text-xs">{link}</code>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          void navigator.clipboard
            ?.writeText(link)
            .then(() => toast.success("Hospital link copied"))
            .catch(() => toast.error("Copy failed"));
        }}
      >
        <Copy aria-hidden="true" /> Copy
      </Button>
    </div>
  );
}

function BrandingForm({ tenant, disabled }: { tenant: Tenant; disabled: boolean }) {
  const run = useRunAction();
  const update = usePlatformStore((s) => s.updateBranding);
  const userId = useSessionStore((s) => s.userId);
  const me = useStaffStore((s) => s.staff.find((x) => x.id === userId));
  const form = useZodForm<Branding>(brandingSchema, {
    name: tenant.name,
    shortName: tenant.shortName,
    tagline: tenant.tagline,
    primaryColor: tenant.primaryColor,
    logoDataUrl: tenant.logoDataUrl,
    address: tenant.address,
    city: tenant.city,
    phone: tenant.phone,
    email: tenant.email,
  });
  const values = form.watch();
  return (
    <Form {...form}>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={form.handleSubmit((v) => {
          const next = run(() => update(tenant.slug, v, me?.name ?? "Hospital admin"), {
            success: "Branding saved — everyone sees it on their next screen",
            setError: form.setError,
          });
          if (next) {
            applyTenant(next);
            audit("update", "settings", "Updated hospital branding");
          }
        })}
      >
        <BrandFields
          logo={values.logoDataUrl}
          color={values.primaryColor}
          disabled={disabled}
          onLogo={(d) => form.setValue("logoDataUrl", d, { shouldDirty: true })}
          onColor={(c) => form.setValue("primaryColor", c, { shouldDirty: true, shouldValidate: true })}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField control={form.control} name="name" label="Hospital name" required disabled={disabled} />
          <TextField control={form.control} name="shortName" label="Short name" required disabled={disabled} />
          <TextField control={form.control} name="tagline" label="Tagline" disabled={disabled} />
          <TextField
            control={form.control}
            name="address"
            label="Address"
            required
            disabled={disabled}
            className="sm:col-span-2"
          />
          <TextField control={form.control} name="city" label="City" required disabled={disabled} />
          <TextField control={form.control} name="phone" label="Phone" type="tel" required disabled={disabled} />
          <TextField control={form.control} name="email" label="Email" type="email" required disabled={disabled} />
        </div>
        {!disabled ? (
          <Button type="submit" className="w-fit">
            Save branding
          </Button>
        ) : null}
      </form>
    </Form>
  );
}

/** Hospital admin: the hospital's own branding, link and payment setup. */
export function BrandingPanel() {
  const canEdit = usePermission("admin.settings");
  const tenant = useActiveTenant();
  if (!tenant) return null;
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <SectionCard title="Branding" description="How the system looks to your staff and on everything you print.">
        <BrandingForm key={tenant.slug} tenant={tenant} disabled={!canEdit} />
      </SectionCard>
      <div className="grid content-start gap-4">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Link2 className="size-4" aria-hidden="true" /> Your hospital&apos;s link
            </span>
          }
          description="Staff open this link to reach your hospital's sign-in page."
        >
          <CopyHospitalLink tenant={tenant} />
          <p className="text-muted-foreground mt-2 text-xs">In production: {tenant.slug}.overcare.ng</p>
        </SectionCard>
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Landmark className="size-4" aria-hidden="true" /> Payments
            </span>
          }
          description="Patient payments are collected by Paystack and settled to this account the next working day."
        >
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Settlement account</dt>
              <dd className="text-right">
                {tenant.settlement.bankName} ••••{tenant.settlement.accountNumber.slice(-4)}
                <span className="text-muted-foreground block text-xs">{tenant.settlement.accountName}</span>
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Paystack subaccount</dt>
              <dd className="font-mono text-xs">{tenant.subaccountCode}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Platform service charge</dt>
              <dd>
                {tenant.feePercent}%{tenant.feeCap ? ` (max ${formatMoney(tenant.feeCap)})` : ""} of gateway payments
              </dd>
            </div>
          </dl>
          <p className="text-muted-foreground mt-3 text-xs">
            To change the settlement account, raise a ticket in Subscription &amp; support (verified by Overcare for
            your safety).
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
