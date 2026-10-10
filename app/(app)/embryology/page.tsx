import { Suspense } from "react";
import type { Metadata } from "next";
import { EmbryologyView } from "@/components/embryology/embryology-view";

export const metadata: Metadata = { title: "Embryology lab" };

export default function EmbryologyPage() {
  return (
    <Suspense>
      <EmbryologyView />
    </Suspense>
  );
}
