import { Suspense } from "react";
import type { Metadata } from "next";
import { SupportDesk } from "@/components/platform/support-desk";

export const metadata: Metadata = { title: "Support desk" };

export default function PlatformTicketsPage() {
  return (
    <Suspense>
      <SupportDesk />
    </Suspense>
  );
}
