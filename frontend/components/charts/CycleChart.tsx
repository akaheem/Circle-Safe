"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatMoney } from "@/lib/format";

export interface CyclePoint {
  cycle: number;
  confirmed: number;
  pending: number;
}

/** Confirmed vs pending contribution value per cycle. */
export default function CycleChart({ data, currency }: { data: CyclePoint[]; currency: string }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} stroke="#E4EFE9" />
        <XAxis
          dataKey="cycle" tickFormatter={(c) => `C${c}`} tickLine={false} axisLine={false}
          tick={{ fill: "#5C7268", fontSize: 12 }}
        />
        <YAxis
          tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} tickLine={false} axisLine={false}
          tick={{ fill: "#5C7268", fontSize: 12 }} width={48}
        />
        <Tooltip
          cursor={{ fill: "rgba(15,169,104,.06)" }}
          contentStyle={{
            borderRadius: 12, border: "1px solid #E4EFE9", fontSize: 13,
            boxShadow: "0 18px 40px -24px rgba(20,40,30,.28)",
          }}
          labelFormatter={(c) => `Cycle ${c}`}
          formatter={(value: number, name) => [formatMoney(value, currency), name === "confirmed" ? "Confirmed" : "Pending"]}
        />
        <Bar dataKey="confirmed" radius={[6, 6, 0, 0]} fill="#0FA968" />
        <Bar dataKey="pending" radius={[6, 6, 0, 0]} fill="#F5B301">
          {data.map((d) => (
            <Cell key={d.cycle} fillOpacity={d.pending ? 1 : 0} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
