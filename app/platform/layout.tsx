import type { Metadata } from "next";
import { PlatformShell } from "@/components/platform/platform-shell";

export const metadata: Metadata = { title: { default: "Platform console", template: "%s · Overcare platform" } };

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>;
}
