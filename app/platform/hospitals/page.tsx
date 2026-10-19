import type { Metadata } from "next";
import { HospitalsListPage } from "@/components/platform/platform-overview";

export const metadata: Metadata = { title: "Hospitals" };

export default function PlatformHospitalsPage() {
  return <HospitalsListPage />;
}
