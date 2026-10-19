import type { Metadata } from "next";
import { PlatformSettings } from "@/components/platform/platform-settings";

export const metadata: Metadata = { title: "Settings & audit" };

export default function PlatformSettingsPage() {
  return <PlatformSettings />;
}
