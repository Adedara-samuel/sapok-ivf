import type { Metadata } from "next";
import { CycleWorkspace } from "@/components/cycle/cycle-workspace";

export const metadata: Metadata = { title: "Cycle workspace" };

export default async function CyclePage({ params }: { params: Promise<{ id: string; cycleId: string }> }) {
  const { id, cycleId } = await params;
  return <CycleWorkspace patientId={id} cycleId={cycleId} />;
}
