import type { Metadata } from "next";
import { CounsellingView } from "@/components/counselling/counselling-view";

export const metadata: Metadata = { title: "Counselling" };

export default function CounsellingPage() {
  return <CounsellingView />;
}
