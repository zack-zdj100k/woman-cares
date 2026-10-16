"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

/**
 * Two-or-more series over time (app-1 reference). The first series is filled, the others are dashed
 * lines, so they separate by form and not only by colour.
 */
export function TrendChart({
  data,
  series,
  xKey,
  height = 256,
  money,
  rtl = false,
}: {
  data: Record<string, string | number>[];
  series: { key: string; label: string; color: string }[];
  xKey: string;
  height?: number;
  money?: { locale: string; currency: string };
  /** Arabic: time runs right to left. */
  rtl?: boolean;
}) {
  const config: ChartConfig = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }]));
  const fmt = money ? new Intl.NumberFormat(money.locale, { style: "currency", currency: money.currency, maximumFractionDigits: 0, numberingSystem: "latn" } as Intl.NumberFormatOptions) : undefined;
  const [first, ...rest] = series;
  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 8 }} accessibilityLayer>
        <defs>
          <linearGradient id={`fill-${first.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`var(--color-${first.key})`} stopOpacity={0.3} />
            <stop offset="100%" stopColor={`var(--color-${first.key})`} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgb(255 255 255 / 0.07)" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} reversed={rtl} />
        <YAxis orientation={rtl ? "right" : "left"} tickLine={false} axisLine={false} width={money ? 64 : 32} allowDecimals={false} tickFormatter={fmt ? (v: number) => fmt.format(v) : undefined} />
        <ChartTooltip content={<ChartTooltipContent valueFormatter={fmt ? (v) => fmt.format(v) : undefined} />} />
        <ChartLegend content={<ChartLegendContent />} />
        {rest.map((s) => (
          <Area key={s.key} dataKey={s.key} type="monotone" stroke={`var(--color-${s.key})`} strokeDasharray="4 4" fill="none" strokeWidth={2} />
        ))}
        <Area dataKey={first.key} type="monotone" stroke={`var(--color-${first.key})`} fill={`url(#fill-${first.key})`} strokeWidth={2} />
      </AreaChart>
    </ChartContainer>
  );
}
