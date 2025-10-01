"use client";

import { PieChart, Pie, ResponsiveContainer, Cell } from "recharts";

/** Tipul datelor așteptate de grafic */
export type PieDatum = { name: string; value: number };

/** Paletă (acum este folosită efectiv în <Cell />) */
const COLORS = [
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#22c55e",
];

type Props = {
  data: PieDatum[];
  total: number; // total răspunsuri pentru calcul procente
  title?: string;
};

export default function OptionPieChart({ data, total, title }: Props) {
  const safeTotal = Math.max(total, 1); // evităm împărțirea la 0

  return (
    <div className="w-full">
      {title ? <div className="text-sm text-gray-600 mb-2">{title}</div> : null}

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              outerRadius="80%"
              isAnimationActive={false}
              labelLine={false}
              // etichetele custom pot fi re-adăugate ulterior dacă vrei,
              // dar le-am oprit pentru a evita problemele de tipizare
            >
              {data.map((_, i) => (
                <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legendă simplă sub grafic (fără a depinde de tipurile Recharts) */}
      <div className="mt-3 space-y-1">
        {data.map((d, i) => {
          const pct = Number(((d.value / safeTotal) * 100).toFixed(2));
          return (
            <div
              key={`legend-${i}`}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded"
                  style={{ background: COLORS[i % COLORS.length] }}
                  aria-hidden
                />
                <span className="text-gray-700">{d.name}</span>
              </div>
              <div className="tabular-nums text-gray-600">{pct}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
