"use client";

/*
 * shadcn chart wrapper around Recharts (from the owner's "app-1" component list). Colours come from the
 * config as CSS variables (--color-<key>) so series read the dashboard tokens. Fixed from the pasted
 * version: string joins used literal line breaks, which broke the file.
 */
import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<string, { label?: React.ReactNode; icon?: React.ComponentType; color?: string }>;

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error("useChart must be used within a <ChartContainer />");
  return context;
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & { config: ChartConfig; children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"] }) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          "flex justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-layer]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const entries = Object.entries(config).filter(([, c]) => c.color);
  if (!entries.length) return null;
  const css = `[data-chart=${id}] {\n${entries.map(([key, c]) => `  --color-${key}: ${c.color};`).join("\n")}\n}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

type TooltipItem = { dataKey?: string | number; name?: string | number; value?: number | string; color?: string; payload?: Record<string, unknown> };

export function ChartTooltipContent({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
  valueFormatter?: (v: number) => string;
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;
  return (
    <div className="grid min-w-[9rem] gap-1.5 rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl">
      {label !== undefined && <p className="font-medium">{String(label)}</p>}
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.name ?? "value");
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: item.color }} />
            <span className="text-muted-foreground">{config[key]?.label ?? item.name}</span>
            <span className="ms-auto font-medium tabular-nums">
              {typeof item.value === "number" && valueFormatter ? valueFormatter(item.value) : String(item.value ?? "")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const ChartLegend = RechartsPrimitive.Legend;

export function ChartLegendContent({ payload }: { payload?: { value?: string; dataKey?: string | number; color?: string }[] }) {
  const { config } = useChart();
  if (!payload?.length) return null;
  return (
    <div className="flex items-center justify-center gap-4 pt-3">
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.value ?? "");
        return (
          <div key={key} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
            {config[key]?.label ?? item.value}
          </div>
        );
      })}
    </div>
  );
}
