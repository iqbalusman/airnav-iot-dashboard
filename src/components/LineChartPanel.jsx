import React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export default function LineChartPanel({
  data,
  lines,
  margin,
  yDomain,
  xKey = 'jam',
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} />
        <YAxis domain={yDomain} />
        <Tooltip />
        <Legend />
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type={line.type || 'monotone'}
            dataKey={line.dataKey}
            name={line.name}
            stroke={line.stroke}
            strokeWidth={line.strokeWidth || 3}
            dot={line.dot}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
