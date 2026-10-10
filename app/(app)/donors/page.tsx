import type { Metadata } from "next";
import { DonorsView } from "@/components/programme/donors-view";

export const metadata: Metadata = { title: "Donors" };

export default function DonorsPage() {
  return <DonorsView />;
}
