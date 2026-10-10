import type { Metadata } from "next";
import { SurrogatesView } from "@/components/programme/surrogates-view";

export const metadata: Metadata = { title: "Surrogates" };

export default function SurrogatesPage() {
  return <SurrogatesView />;
}
