"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { TrustScoreRow } from "@/lib/types";

const barColor = (pct: number) => (pct >= 90 ? "#0FA968" : pct >= 70 ? "#34E0A1" : "#F5B301");

/** Horizontal reliability bars, one per member. */
export default function TrustChart({ rows }: { rows: TrustScoreRow[] }) {
  const data = rows.map((r) => ({ name: r.name.split(" ")[0], pct: Number(r.reliability_pct) || 0 }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 46)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke="#E4EFE9" />
        <XAxis
          type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false}
          tick={{ fill: "#5C7268", fontSize: 12 }}
        />
        <YAxis
          type="category" dataKey="name" tickLine={false} axisLine={false} width={80}
          tick={{ fill: "#1C2B27", fontSize: 13 }}
        />
        <Tooltip
          cursor={{ fill: "rgba(15,169,104,.06)" }}
          contentStyle={{ borderRadius: 12, border: "1px solid #E4EFE9", fontSize: 13 }}
          formatter={(v: number) => [`${v}%`, "Reliability"]}
        />
        <Bar dataKey="pct" radius={[0, 6, 6, 0]} barSize={20}>
          {data.map((d) => (
            <Cell key={d.name} fill={barColor(d.pct)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
