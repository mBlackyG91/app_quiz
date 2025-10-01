"use client";

import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";

type Props = {
  value: number; // 0..100
  title?: string;
};

export default function ScoreRadial({ value, title }: Props) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const data = [{ name: "score", value: v, fill: "#10b981" }];

  return (
    <div className="w-full h-full relative">
      {title ? <div className="text-sm text-gray-600 mb-2">{title}</div> : null}
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={data}
          innerRadius="70%"
          outerRadius="90%"
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={8} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-xl font-semibold">{v.toFixed(0)}%</div>
      </div>
    </div>
  );
}
