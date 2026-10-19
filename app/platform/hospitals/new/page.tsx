import type { Metadata } from "next";
import { OnboardHospital } from "@/components/platform/onboard-hospital";

export const metadata: Metadata = { title: "Onboard hospital" };

export default function OnboardHospitalPage() {
  return <OnboardHospital />;
}
