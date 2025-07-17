import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import React from "react";

interface EquityCurveChartProps {
  data: { x: number; y: number }[];
}

export default function EquityCurveChart({ data }: EquityCurveChartProps) {
  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <XAxis dataKey="x" tick={{ fill: "#fff" }} />
          <YAxis tick={{ fill: "#fff" }} />
          <Tooltip />
          <Line type="monotone" dataKey="y" stroke="#9c5925" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
} 