import React from 'react';

function getNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getDomain(data, lines, yDomain) {
  if (Array.isArray(yDomain) && yDomain.length === 2) return yDomain;

  const values = data.flatMap((row) => lines.map((line) => getNumber(row[line.dataKey])));
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const padding = Math.max(1, (max - min) * 0.12);

  return [Math.max(0, min - padding), max + padding];
}

function buildPath(data, line, bounds, domain) {
  const { left, top, width, height } = bounds;
  const [minY, maxY] = domain;
  const yRange = maxY - minY || 1;
  const xStep = data.length > 1 ? width / (data.length - 1) : width;

  return data.map((row, index) => {
    const x = left + (index * xStep);
    const y = top + height - (((getNumber(row[line.dataKey]) - minY) / yRange) * height);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

export default function LineChartPanel({
  data = [],
  lines = [],
  yDomain,
  xKey = 'jam',
}) {
  const safeData = Array.isArray(data) ? data : [];
  const safeLines = Array.isArray(lines) ? lines : [];
  const width = 760;
  const height = 280;
  const bounds = { left: 54, top: 8, width: 670, height: 220 };
  const domain = getDomain(safeData, safeLines, yDomain);
  const [minY, maxY] = domain;
  const ticks = Array.from({ length: 5 }, (_, index) => minY + (((maxY - minY) / 4) * index));
  const labelIndexes = safeData.length <= 5
    ? safeData.map((_, index) => index)
    : [0, Math.floor(safeData.length / 3), Math.floor((safeData.length / 3) * 2), safeData.length - 1];

  if (safeData.length === 0 || safeLines.length === 0) {
    return <div className="grid h-full w-full place-items-center text-sm font-black text-slate-400">Belum ada data grafik.</div>;
  }

  return (
    <div className="h-full w-full">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block h-full w-full overflow-visible" role="img">
        {ticks.map((tick) => {
          const y = bounds.top + bounds.height - (((tick - minY) / ((maxY - minY) || 1)) * bounds.height);
          return (
            <g key={tick}>
              <line x1={bounds.left} y1={y} x2={bounds.left + bounds.width} y2={y} stroke="#cbd5e1" strokeDasharray="4 6" strokeWidth="1" />
              <text x={bounds.left - 10} y={y + 4} textAnchor="end" className="fill-slate-500 text-[12px] font-bold">{Math.round(tick).toLocaleString('id-ID')}</text>
            </g>
          );
        })}
        <line x1={bounds.left} y1={bounds.top} x2={bounds.left} y2={bounds.top + bounds.height} stroke="#94a3b8" />
        <line x1={bounds.left} y1={bounds.top + bounds.height} x2={bounds.left + bounds.width} y2={bounds.top + bounds.height} stroke="#94a3b8" />

        {safeLines.map((line) => (
          <path key={line.dataKey} d={buildPath(safeData, line, bounds, domain)} fill="none" stroke={line.stroke || '#0891b2'} strokeWidth={line.strokeWidth || 3} strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {safeLines.flatMap((line) => safeData.map((row, index) => {
          const xStep = safeData.length > 1 ? bounds.width / (safeData.length - 1) : bounds.width;
          const x = bounds.left + (index * xStep);
          const y = bounds.top + bounds.height - (((getNumber(row[line.dataKey]) - minY) / ((maxY - minY) || 1)) * bounds.height);
          const showDot = line.dot !== false;
          return showDot ? (
            <circle key={`${line.dataKey}-${index}`} cx={x} cy={y} r="3.5" fill="white" stroke={line.stroke || '#0891b2'} strokeWidth="2">
              <title>{`${row[xKey] || '-'} - ${line.name || line.dataKey}: ${getNumber(row[line.dataKey]).toLocaleString('id-ID')}`}</title>
            </circle>
          ) : null;
        }))}

        {labelIndexes.map((index) => {
          const row = safeData[index];
          if (!row) return null;
          const xStep = safeData.length > 1 ? bounds.width / (safeData.length - 1) : bounds.width;
          return (
            <text key={`${row[xKey]}-${index}`} x={bounds.left + (index * xStep)} y={bounds.top + bounds.height + 24} textAnchor="middle" className="fill-slate-500 text-[12px] font-bold">
              {row[xKey]}
            </text>
          );
        })}

        <g transform={`translate(${bounds.left + (bounds.width / 2) - 100} ${height - 10})`}>
          {safeLines.map((line, index) => (
            <g key={line.dataKey} transform={`translate(${index * 150} 0)`}>
              <line x1="0" y1="0" x2="18" y2="0" stroke={line.stroke || '#0891b2'} strokeWidth="3" strokeLinecap="round" />
              <text x="24" y="4" className="fill-slate-600 text-[12px] font-black">{line.name || line.dataKey}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
