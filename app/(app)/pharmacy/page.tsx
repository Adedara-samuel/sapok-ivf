import { Suspense } from "react";
import type { Metadata } from "next";
import { PharmacyView } from "@/components/pharmacy/pharmacy-view";

export const metadata: Metadata = { title: "Pharmacy" };

export default function PharmacyPage() {
  return (
    <Suspense>
      <PharmacyView />
    </Suspense>
  );
}
