import type { Metadata } from "next";
import { HospitalDetail } from "@/components/platform/hospital-detail";

export const metadata: Metadata = { title: "Hospital" };

export default async function PlatformHospitalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <HospitalDetail slug={slug} />;
}
