"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactMoney, formatMoney } from "@/lib/utils/money";

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
];

const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--popover-foreground)",
  },
  labelStyle: { color: "var(--muted-foreground)" },
} as const;

export interface SeriesDef {
  key: string;
  label: string;
  color?: string;
}

export function DonutChart({ data, height = 240 }: { data: { name: string; value: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          stroke="var(--card)"
          animationDuration={400}
        >
          {data.map((d, i) => (
            <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SimpleBarChart<T extends object>({
  data,
  xKey,
  series,
  height = 240,
  money = false,
  layout = "horizontal",
}: {
  data: T[];
  xKey: string;
  series: SeriesDef[];
  height?: number;
  money?: boolean;
  layout?: "horizontal" | "vertical";
}) {
  const vertical = layout === "vertical";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ left: vertical ? 24 : 0, right: 8, top: 8 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={!vertical}
          horizontal={vertical ? false : true}
        />
        {vertical ? (
          <>
            <XAxis
              type="number"
              {...axis}
              tickFormatter={money ? (v: number) => formatCompactMoney(v) : undefined}
              allowDecimals={false}
            />
            <YAxis type="category" dataKey={xKey} {...axis} width={110} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...axis} />
            <YAxis
              {...axis}
              tickFormatter={money ? (v: number) => formatCompactMoney(v) : undefined}
              allowDecimals={false}
              width={money ? 56 : 32}
            />
          </>
        )}
        <Tooltip
          {...tooltipStyle}
          formatter={money ? (v) => formatMoney(Number(v)) : undefined}
          cursor={{ fill: "var(--muted)" }}
        />
        {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={36}
            animationDuration={400}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimpleLineChart<T extends object>({
  data,
  xKey,
  series,
  height = 240,
  unit,
  yDomain,
}: {
  data: T[];
  xKey: string;
  series: SeriesDef[];
  height?: number;
  unit?: string;
  yDomain?: [number, number];
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={xKey} {...axis} />
        <YAxis {...axis} unit={unit} domain={yDomain} width={44} />
        <Tooltip {...tooltipStyle} formatter={unit ? (v) => `${String(v)}${unit}` : undefined} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
            animationDuration={400}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SimpleAreaChart<T extends object>({
  data,
  xKey,
  series,
  height = 240,
  money = false,
}: {
  data: T[];
  xKey: string;
  series: SeriesDef[];
  height?: number;
  money?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ right: 8, top: 8 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color ?? CHART_COLORS[i]} stopOpacity={0.35} />
              <stop offset="95%" stopColor={s.color ?? CHART_COLORS[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={xKey} {...axis} />
        <YAxis
          {...axis}
          tickFormatter={money ? (v: number) => formatCompactMoney(v) : undefined}
          width={money ? 56 : 32}
        />
        <Tooltip {...tooltipStyle} formatter={money ? (v) => formatMoney(Number(v)) : undefined} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? CHART_COLORS[i]}
            fill={`url(#grad-${s.key})`}
            strokeWidth={2}
            animationDuration={400}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
