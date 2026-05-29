import React from 'react';

export default function ThreatGraph({ log = [] }) {
  // Take up to the last 20 queries, reversing them so oldest is left, newest is right
  const data = [...log].slice(0, 20).reverse();
  const maxRecords = Math.max(15, ...data.map(d => d.recordCount || 0));
  
  const width = 800;
  const height = 180;
  const paddingX = 40;
  const paddingY = 20;
  const rightMargin = 120; // extra space for the threshold text
  
  const chartWidth = width - paddingX - rightMargin;
  const chartHeight = height - paddingY * 2;
  
  const barWidth = chartWidth / Math.max(20, data.length);

  const mutations = log.filter(d => d.tier === 'CRITICAL' || d.isMutation).length;
  const avgSize = log.length > 0 
    ? (log.reduce((acc, d) => acc + (d.recordCount || 0), 0) / log.length).toFixed(1) 
    : '0.0';

  const getTierColor = (tier) => {
    if (tier === 'SURGICAL') return '#34d399'; // emerald-400
    if (tier === 'ELEVATED') return '#fbbf24'; // amber-400
    return '#ef4444'; // red-500 for CRITICAL
  };

  return (
    <div className="flex flex-col bg-slate-900 border-b border-slate-700/60 p-4">
      {/* ── Stat Chips ─────────────────────────────────────── */}
      <div className="flex gap-4 mb-4">
        <div className={`px-3 py-1.5 rounded border text-[10px] font-mono font-bold flex items-center gap-2
          ${mutations > 0 ? 'bg-red-950/50 text-red-400 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
          <span className={mutations > 0 ? "animate-pulse" : ""}>⚠</span>
          MUTATIONS DETECTED: {mutations}
        </div>
        <div className={`px-3 py-1.5 rounded border text-[10px] font-mono font-bold flex items-center gap-2
          ${parseFloat(avgSize) > 10 ? 'bg-red-950/50 text-red-400 border-red-500/50' : 
            parseFloat(avgSize) > 4 ? 'bg-amber-950/50 text-amber-400 border-amber-500/50' : 
            'bg-emerald-950/50 text-emerald-400 border-emerald-500/50'}`}>
          AVG QUERY SIZE: {avgSize} records
        </div>
      </div>
      
      {/* ── SVG Chart ───────────────────────────────────────── */}
      <div className="relative w-full overflow-x-auto bg-slate-900/50 rounded border border-slate-800">
        <svg 
          width="100%" 
          height={height} 
          viewBox={`0 0 ${width} ${height}`} 
          preserveAspectRatio="xMidYMid meet" 
          className="block min-w-[600px]"
        >
          {/* Y Axis Labels & Grid */}
          <text x={paddingX - 10} y={paddingY + 5} fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="end">{maxRecords}</text>
          <text x={paddingX - 10} y={height - paddingY} fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="end">0</text>
          
          <line x1={paddingX} y1={paddingY} x2={width - rightMargin} y2={paddingY} stroke="#334155" strokeDasharray="2 2" />
          <line x1={paddingX} y1={height - paddingY} x2={width - rightMargin} y2={height - paddingY} stroke="#334155" />
          
          {/* CRITICAL THRESHOLD LINE (y=10) */}
          {maxRecords >= 10 && (
            <g>
              <line 
                x1={paddingX} 
                y1={height - paddingY - (10 / maxRecords) * chartHeight} 
                x2={width - rightMargin} 
                y2={height - paddingY - (10 / maxRecords) * chartHeight} 
                stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 4" 
                className="opacity-70"
              />
              <text 
                x={width - rightMargin + 10} 
                y={height - paddingY - (10 / maxRecords) * chartHeight + 4} 
                fill="#ef4444" 
                fontSize="10" 
                fontFamily="monospace"
                fontWeight="bold"
              >
                CRITICAL THRESHOLD
              </text>
            </g>
          )}

          {/* Bars */}
          {data.map((entry, i) => {
            const rc = entry.recordCount || 0;
            const barH = (rc / maxRecords) * chartHeight;
            const x = paddingX + (i * barWidth) + (barWidth * 0.1);
            const y = height - paddingY - barH;
            const isCritical = entry.tier === 'CRITICAL' || entry.isMutation;

            return (
              <g key={entry.id} className="group cursor-pointer">
                {/* Visible Bar */}
                <rect 
                  x={x} 
                  y={y} 
                  width={Math.max(2, barWidth * 0.8)} 
                  height={barH} 
                  fill={getTierColor(entry.tier)}
                  className="transition-all duration-300 group-hover:opacity-80"
                  style={isCritical ? { filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.8))' } : {}}
                />
                
                {/* Invisible Hover Target (covers full height for easier hovering) */}
                <rect 
                  x={x} 
                  y={paddingY} 
                  width={barWidth} 
                  height={chartHeight} 
                  fill="transparent" 
                />
                
                {/* Custom SVG Tooltip (shows on hover) */}
                <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {/* Tooltip Background */}
                  <rect 
                    x={Math.min(x - 50, width - 150)} 
                    y={Math.max(10, y - 45)} 
                    width="140" 
                    height="40" 
                    fill="#0f172a" 
                    stroke="#334155" 
                    rx="4" 
                  />
                  {/* Tooltip Text */}
                  <text 
                    x={Math.min(x - 50, width - 150) + 70} 
                    y={Math.max(10, y - 45) + 15} 
                    fill="#f1f5f9" 
                    fontSize="10" 
                    fontFamily="monospace"
                    textAnchor="middle" 
                    fontWeight="bold"
                  >
                    {entry.tier} ({rc} records)
                  </text>
                  <text 
                    x={Math.min(x - 50, width - 150) + 70} 
                    y={Math.max(10, y - 45) + 30} 
                    fill="#94a3b8" 
                    fontSize="9" 
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {entry.ts} {entry.classification ? `· ${entry.classification}` : ''}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
