import type { Metadata } from "next";
import { HospitalEntry } from "@/components/auth/hospital-entry";

export const metadata: Metadata = { title: "Opening hospital" };

export default async function HospitalLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <HospitalEntry slug={slug.toLowerCase()} />;
}
