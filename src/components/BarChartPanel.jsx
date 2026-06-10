import React from 'react';

function getNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export default function BarChartPanel({
  data = [],
  bars = [],
  xKey = 'namaAlat',
  yLabel,
}) {
  const safeData = Array.isArray(data) ? data : [];
  const safeBars = Array.isArray(bars) ? bars : [];
  const width = 760;
  const height = 280;
  const bounds = { left: 58, top: 10, width: 668, height: 205 };
  const maxValue = Math.max(1, ...safeData.flatMap((row) => safeBars.map((bar) => getNumber(row[bar.dataKey]))));
  const ticks = Array.from({ length: 5 }, (_, index) => (maxValue / 4) * index);
  const groupWidth = safeData.length ? bounds.width / safeData.length : bounds.width;
  const barGap = 6;
  const barWidth = Math.max(8, Math.min(28, (groupWidth - 18) / Math.max(1, safeBars.length)));

  if (safeData.length === 0 || safeBars.length === 0) {
    return <div className="grid h-full w-full place-items-center text-sm font-black text-slate-400">Belum ada data grafik.</div>;
  }

  return (
    <div className="h-full w-full">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block h-full w-full overflow-visible" role="img">
        {ticks.map((tick) => {
          const y = bounds.top + bounds.height - ((tick / maxValue) * bounds.height);
          return (
            <g key={tick}>
              <line x1={bounds.left} y1={y} x2={bounds.left + bounds.width} y2={y} stroke="#cbd5e1" strokeDasharray="4 6" strokeWidth="1" />
              <text x={bounds.left - 10} y={y + 4} textAnchor="end" className="fill-slate-500 text-[12px] font-bold">{Math.round(tick).toLocaleString('id-ID')}</text>
            </g>
          );
        })}
        <line x1={bounds.left} y1={bounds.top} x2={bounds.left} y2={bounds.top + bounds.height} stroke="#94a3b8" />
        <line x1={bounds.left} y1={bounds.top + bounds.height} x2={bounds.left + bounds.width} y2={bounds.top + bounds.height} stroke="#94a3b8" />
        {yLabel && (
          <text x="16" y={bounds.top + (bounds.height / 2)} transform={`rotate(-90 16 ${bounds.top + (bounds.height / 2)})`} textAnchor="middle" className="fill-slate-500 text-[12px] font-black">
            {yLabel}
          </text>
        )}

        {safeData.map((row, rowIndex) => {
          const groupX = bounds.left + (rowIndex * groupWidth) + (groupWidth / 2);
          const totalBarsWidth = (safeBars.length * barWidth) + ((safeBars.length - 1) * barGap);
          const startX = groupX - (totalBarsWidth / 2);

          return (
            <g key={`${row[xKey]}-${rowIndex}`}>
              {safeBars.map((bar, barIndex) => {
                const value = getNumber(row[bar.dataKey]);
                const barHeight = (value / maxValue) * bounds.height;
                const x = startX + (barIndex * (barWidth + barGap));
                const y = bounds.top + bounds.height - barHeight;
                return (
                  <rect key={bar.dataKey} x={x} y={y} width={barWidth} height={barHeight} rx="6" fill={bar.fill || '#7c3aed'}>
                    <title>{`${row[xKey]} - ${bar.name || bar.dataKey}: ${value.toLocaleString('id-ID')} menit`}</title>
                  </rect>
                );
              })}
              <text x={groupX} y={bounds.top + bounds.height + 26} textAnchor="middle" transform={`rotate(-18 ${groupX} ${bounds.top + bounds.height + 26})`} className="fill-slate-500 text-[11px] font-bold">
                {row[xKey]}
              </text>
            </g>
          );
        })}

        <g transform={`translate(${bounds.left + (bounds.width / 2) - 130} ${height - 10})`}>
          {safeBars.map((bar, index) => (
            <g key={bar.dataKey} transform={`translate(${index * 170} 0)`}>
              <rect x="0" y="-8" width="14" height="14" rx="4" fill={bar.fill || '#7c3aed'} />
              <text x="22" y="4" className="fill-slate-600 text-[12px] font-black">{bar.name || bar.dataKey}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
