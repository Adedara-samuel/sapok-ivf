"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const loading = () => <Skeleton className="h-60 w-full" />;

/** Charts are lazy-loaded so recharts never blocks first paint. */
export const DonutChart = dynamic(() => import("@/components/charts/charts").then((m) => m.DonutChart), {
  ssr: false,
  loading,
});
export const SimpleBarChart = dynamic(() => import("@/components/charts/charts").then((m) => m.SimpleBarChart), {
  ssr: false,
  loading,
}) as typeof import("@/components/charts/charts").SimpleBarChart;
export const SimpleLineChart = dynamic(() => import("@/components/charts/charts").then((m) => m.SimpleLineChart), {
  ssr: false,
  loading,
}) as typeof import("@/components/charts/charts").SimpleLineChart;
export const SimpleAreaChart = dynamic(() => import("@/components/charts/charts").then((m) => m.SimpleAreaChart), {
  ssr: false,
  loading,
}) as typeof import("@/components/charts/charts").SimpleAreaChart;
