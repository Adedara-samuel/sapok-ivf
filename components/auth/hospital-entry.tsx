"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { usePlatformStore } from "@/lib/stores/platform";
import { activeTenantSlug, setActiveTenantSlug } from "@/lib/tenancy";

/**
 * A hospital's own link (/h/<slug>). In production each hospital gets a subdomain (lagoon.overcare.ng); here the
 * link selects the hospital in this browser and reloads so only that hospital's data is loaded.
 */
export function HospitalEntry({ slug }: { slug: string }) {
  const tenant = usePlatformStore((s) => s.tenants.find((t) => t.slug === slug));

  useEffect(() => {
    if (!tenant) return;
    // full reload so every store re-hydrates from this hospital's storage
    if (activeTenantSlug() !== tenant.slug) setActiveTenantSlug(tenant.slug);
    window.location.replace("/login");
  }, [tenant]);

  if (!tenant)
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          icon={Building2}
          title="Hospital not found"
          description={`No hospital uses the link “${slug}”. Check the link you were given, or contact Overcare support.`}
          action={
            <Button asChild variant="outline">
              <Link href="/login">Go to sign-in</Link>
            </Button>
          }
        />
      </main>
    );

  return (
    <main className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
      <p className="text-muted-foreground text-sm">Opening {tenant.name}…</p>
    </main>
  );
}
