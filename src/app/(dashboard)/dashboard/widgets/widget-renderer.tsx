"use client";

import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { QueryResult } from "@/lib/query-engine";
import type { VisualType } from "@/types/dashboard";

const PALETTE = ["#1B3B6B", "#C8892A", "#10B981", "#6366F1", "#EF4444", "#F59E0B", "#8B5CF6"];

interface Props {
  label: string;
  visualType: VisualType;
  result: QueryResult;
}

export function WidgetRenderer({ label, visualType, result }: Props) {
  const { rows, measureLabel, groupByLabel } = result;

  if (visualType === "counter") {
    const value = rows[0]?._value ?? 0;
    return (
      <div
        className="h-full rounded-xl flex flex-col items-center justify-center gap-1 p-4"
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
          {label}
        </p>
        <p className="text-4xl font-bold tabular-nums" style={{ color: "var(--color-text)" }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{measureLabel}</p>
      </div>
    );
  }

  if (visualType === "table") {
    const cols = rows[0] ? Object.keys(rows[0]).filter((k) => k !== "_value") : [];
    return (
      <div
        className="h-full rounded-xl overflow-auto p-3"
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
      >
        <p className="text-xs font-semibold mb-2 px-1" style={{ color: "var(--color-text)" }}>{label}</p>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
              {cols.map((c) => (
                <th key={c} className="text-left px-2 py-1 font-medium" style={{ color: "var(--color-text-muted)" }}>
                  {groupByLabel ?? c}
                </th>
              ))}
              <th className="text-right px-2 py-1 font-medium" style={{ color: "var(--color-text-muted)" }}>
                {measureLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}>
                {cols.map((c) => (
                  <td key={c} className="px-2 py-1" style={{ color: "var(--color-text)" }}>{String(row[c] ?? "")}</td>
                ))}
                <td className="text-right px-2 py-1 tabular-nums" style={{ color: "var(--color-text)" }}>
                  {String(row._value ?? "")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (visualType === "donut") {
    const data = rows.map((r, i) => {
      const nameKey = Object.keys(r).find((k) => k !== "_value") ?? "_value";
      return { name: String(r[nameKey] ?? i), value: Number(r._value) };
    });
    return (
      <div
        className="h-full rounded-xl flex flex-col p-3"
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
      >
        <p className="text-xs font-semibold mb-1 px-1" style={{ color: "var(--color-text)" }}>{label}</p>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="50%" paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // bar, line, area
  const groupKey = Object.keys(rows[0] ?? {}).find((k) => k !== "_value") ?? "group";

  const commonProps = {
    data: rows,
    margin: { top: 4, right: 8, left: 0, bottom: 0 },
  };

  const axisStyle = { fontSize: 10, fill: "var(--color-text-muted)" };

  return (
    <div
      className="h-full rounded-xl flex flex-col p-3"
      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
    >
      <p className="text-xs font-semibold mb-1 px-1" style={{ color: "var(--color-text)" }}>{label}</p>
      <ResponsiveContainer width="100%" height="100%">
        {visualType === "bar" ? (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey={groupKey} tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }} />
            <Bar dataKey="_value" name={measureLabel} fill={PALETTE[0]} radius={[3, 3, 0, 0]} />
          </BarChart>
        ) : visualType === "area" ? (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey={groupKey} tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }} />
            <Area dataKey="_value" name={measureLabel} stroke={PALETTE[0]} fill={`${PALETTE[0]}33`} dot={false} />
          </AreaChart>
        ) : (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey={groupKey} tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }} />
            <Line dataKey="_value" name={measureLabel} stroke={PALETTE[0]} dot={false} strokeWidth={2} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
