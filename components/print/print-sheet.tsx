"use client";

import { forwardRef, type ReactNode } from "react";
import { useActiveTenant } from "@/hooks/use-tenant";
import { useSettingsStore } from "@/lib/stores/settings";
import { formatDateTime, nowIso } from "@/lib/utils/dates";

export interface PrintIdentifier {
  label: string;
  value: string;
}

/** A4 printable sheet with the hospital's letterhead, patient identifiers and a "Demo data" watermark. */
export const PrintSheet = forwardRef<
  HTMLDivElement,
  { title: string; identifiers?: PrintIdentifier[]; children: ReactNode; branchId?: string }
>(function PrintSheet({ title, identifiers = [], children, branchId = "BR-01" }, ref) {
  const clinic = useSettingsStore((s) => s.clinic.clinicName);
  const branches = useSettingsStore((s) => s.branches);
  const tenant = useActiveTenant();
  const branch = branches.find((b) => b.id === branchId) ?? branches[0];
  const brand = tenant?.primaryColor ?? "#0F766E";
  return (
    <div ref={ref} className="print-sheet bg-white p-8 text-[12px] text-[#0F1F20]">
      <header className="mb-4 flex items-start justify-between border-b-2 pb-3" style={{ borderColor: brand }}>
        <div className="flex items-start gap-3">
          {tenant?.logoDataUrl ? (
            <img src={tenant.logoDataUrl} alt="" className="size-12 rounded object-contain" />
          ) : null}
          <div>
            <p className="text-lg font-bold" style={{ color: brand }}>
              {clinic}
            </p>
            <p className="text-[#5B6B6D]">{tenant?.tagline || "IVF & fertility care"}</p>
            {branch ? <p>{branch.name}</p> : null}
            {branch ? <p className="text-[#5B6B6D]">{branch.address}</p> : null}
            {tenant ? (
              <p className="text-[#5B6B6D]">
                {tenant.phone} · {tenant.email}
              </p>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold">{title}</p>
          <p className="text-[#5B6B6D]">Printed {formatDateTime(nowIso())}</p>
          <p className="font-semibold text-[#DC2626]">DEMO DATA — not a medical record</p>
        </div>
      </header>
      {identifiers.length > 0 ? (
        <dl className="mb-4 grid grid-cols-3 gap-x-4 gap-y-1 rounded border border-[#E2E8E8] p-2">
          {identifiers.map((i) => (
            <div key={i.label} className="flex gap-1">
              <dt className="text-[#5B6B6D]">{i.label}:</dt>
              <dd className="font-medium">{i.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="relative z-10">{children}</div>
    </div>
  );
});

export function PrintSection({ title, children }: { title: string; children: ReactNode }) {
  const tenant = useActiveTenant();
  return (
    <section className="print-avoid-break mb-4">
      <h2
        className="mb-1 border-b border-[#E2E8E8] text-[13px] font-semibold"
        style={{ color: tenant?.primaryColor ?? "#0F766E" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
