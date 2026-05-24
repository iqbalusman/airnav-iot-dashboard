import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export default function BarChartPanel({
  data,
  bars,
  margin,
  xKey = 'namaAlat',
  yLabel,
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} interval={0} angle={-18} textAnchor="end" height={68} />
        <YAxis label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft' } : undefined} />
        <Tooltip />
        <Legend />
        {bars.map((bar) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            name={bar.name}
            fill={bar.fill}
            radius={bar.radius || [8, 8, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
