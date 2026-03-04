import { useState, useRef, useEffect } from 'react';

interface HeatMapProps {
  /** 7x24 matrix: data[dayOfWeek][hour] = count. dayOfWeek 0=ma, 6=zo */
  data: number[][];
  height?: number;
}

const DAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i}:00`);

// Color interpolation from gray to violet based on intensity
function getColor(value: number, max: number): string {
  if (max === 0 || value === 0) return '#F8FAFC'; // gray-50
  const intensity = value / max;
  if (intensity < 0.25) return '#EDE9FE'; // violet-100
  if (intensity < 0.5) return '#DDD6FE';  // violet-200
  if (intensity < 0.75) return '#A78BFA'; // violet-400
  return '#7C3AED'; // violet-600
}

export function HeatMap({ data, height: propHeight }: HeatMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [tooltip, setTooltip] = useState<{ day: number; hour: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Find max value for color scaling
  const maxValue = Math.max(...data.flat(), 1);

  const labelWidth = 28;
  const headerHeight = 20;
  const gridWidth = width - labelWidth;
  const cellWidth = gridWidth / 24;
  const cellHeight = 20;
  const totalHeight = propHeight || headerHeight + 7 * cellHeight + 8;
  const gap = 2;

  if (width === 0) {
    return <div ref={containerRef} style={{ height: totalHeight }} />;
  }

  return (
    <div ref={containerRef} className="w-full select-none relative">
      <svg width={width} height={totalHeight}>
        {/* Hour labels at top */}
        {Array.from({ length: 24 }, (_, h) => {
          // Only show every 2-3 hours on mobile
          const show = cellWidth > 18 ? true : h % 3 === 0;
          if (!show) return null;
          return (
            <text
              key={h}
              x={labelWidth + h * cellWidth + cellWidth / 2}
              y={14}
              textAnchor="middle"
              className="text-[9px] fill-gray-400"
            >
              {h}
            </text>
          );
        })}

        {/* Day rows */}
        {DAY_LABELS.map((day, d) => (
          <g key={d}>
            {/* Day label */}
            <text
              x={0}
              y={headerHeight + d * cellHeight + cellHeight / 2 + 4}
              className="text-[10px] fill-gray-500 font-medium"
            >
              {day}
            </text>

            {/* Hour cells */}
            {Array.from({ length: 24 }, (_, h) => {
              const value = data[d]?.[h] ?? 0;
              return (
                <rect
                  key={h}
                  x={labelWidth + h * cellWidth + gap / 2}
                  y={headerHeight + d * cellHeight + gap / 2}
                  width={Math.max(cellWidth - gap, 2)}
                  height={cellHeight - gap}
                  rx={3}
                  fill={getColor(value, maxValue)}
                  className="cursor-pointer transition-opacity duration-100 hover:opacity-80"
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGRectElement).getBoundingClientRect();
                    const containerRect = containerRef.current!.getBoundingClientRect();
                    setTooltip({
                      day: d,
                      hour: h,
                      x: rect.left - containerRect.left + rect.width / 2,
                      y: rect.top - containerRect.top,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </g>
        ))}
      </svg>

      {/* Tooltip (HTML for better styling) */}
      {tooltip && (
        <div
          className="absolute z-10 pointer-events-none px-2.5 py-1.5 bg-gray-900 text-white rounded-lg text-[11px] font-medium shadow-lg -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y - 4 }}
        >
          {DAY_LABELS[tooltip.day]} {HOUR_LABELS[tooltip.hour]} — {data[tooltip.day]?.[tooltip.hour] ?? 0} boekingen
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-2 mt-2 justify-end">
        <span className="text-[10px] text-gray-400">Minder</span>
        {['#F8FAFC', '#EDE9FE', '#DDD6FE', '#A78BFA', '#7C3AED'].map((c, i) => (
          <div key={i} className="w-3 h-3 rounded-sm" style={{ background: c }} />
        ))}
        <span className="text-[10px] text-gray-400">Meer</span>
      </div>
    </div>
  );
}
