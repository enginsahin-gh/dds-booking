import { useState, useRef, useEffect, useCallback } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface BarChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
  formatValue?: (value: number) => string;
}

const defaultFormat = (v: number) => String(v);

export function BarChart({ data, color = '#8B5CF6', height = 200, formatValue = defaultFormat }: BarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Responsive width observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const padding = { top: 16, right: 8, bottom: 32, left: 8 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  if (data.length === 0 || width === 0) {
    return (
      <div ref={containerRef} style={{ height }} className="flex items-center justify-center text-[13px] text-gray-400">
        {data.length === 0 ? 'Geen data beschikbaar' : ''}
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const barGap = Math.max(2, Math.min(6, chartWidth / data.length * 0.15));
  const barWidth = Math.max(4, (chartWidth - barGap * (data.length - 1)) / data.length);

  const getBarHeight = (v: number) => (v / maxValue) * chartHeight;
  const getX = (i: number) => padding.left + i * (barWidth + barGap);
  const getY = (v: number) => padding.top + chartHeight - getBarHeight(v);

  const handleInteraction = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el || data.length === 0) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left - padding.left;
    const totalBarWidth = barWidth + barGap;
    const index = Math.floor(x / totalBarWidth);
    setHoveredIndex(Math.max(0, Math.min(data.length - 1, index)));
  }, [data.length, barWidth, barGap, padding.left]);

  return (
    <div ref={containerRef} className="w-full select-none" style={{ height }}>
      <svg
        width={width}
        height={height}
        className="overflow-visible"
        onMouseMove={(e) => handleInteraction(e.clientX)}
        onTouchMove={(e) => handleInteraction(e.touches[0].clientX)}
        onMouseLeave={() => setHoveredIndex(null)}
        onTouchEnd={() => setHoveredIndex(null)}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
          <line
            key={i}
            x1={padding.left}
            y1={padding.top + chartHeight * (1 - pct)}
            x2={width - padding.right}
            y2={padding.top + chartHeight * (1 - pct)}
            stroke="#F1F5F9"
            strokeWidth="1"
          />
        ))}

        {/* Bars */}
        {data.map((d, i) => (
          <g key={i}>
            <rect
              x={getX(i)}
              y={getY(d.value)}
              width={barWidth}
              height={Math.max(getBarHeight(d.value), 1)}
              rx={Math.min(barWidth / 2, 4)}
              fill={hoveredIndex === i ? color : color}
              opacity={hoveredIndex === null || hoveredIndex === i ? 1 : 0.5}
              className="transition-opacity duration-150"
            />
          </g>
        ))}

        {/* X-axis labels */}
        {(() => {
          const maxLabels = Math.floor(chartWidth / 32);
          const step = Math.max(1, Math.ceil(data.length / maxLabels));
          return data.map((d, i) => {
            if (i % step !== 0 && i !== data.length - 1) return null;
            return (
              <text
                key={i}
                x={getX(i) + barWidth / 2}
                y={height - 4}
                textAnchor="middle"
                className="text-[10px] fill-gray-400"
              >
                {d.label}
              </text>
            );
          });
        })()}

        {/* Hover tooltip */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <g>
            <rect
              x={Math.max(0, Math.min(getX(hoveredIndex) + barWidth / 2 - 45, width - 96))}
              y={Math.max(0, getY(data[hoveredIndex].value) - 40)}
              width="90"
              height="32"
              rx="8"
              fill="#1E293B"
              opacity="0.95"
            />
            <text
              x={Math.max(45, Math.min(getX(hoveredIndex) + barWidth / 2, width - 51))}
              y={Math.max(14, getY(data[hoveredIndex].value) - 26)}
              textAnchor="middle"
              className="text-[11px] fill-white font-bold"
            >
              {formatValue(data[hoveredIndex].value)}
            </text>
            <text
              x={Math.max(45, Math.min(getX(hoveredIndex) + barWidth / 2, width - 51))}
              y={Math.max(26, getY(data[hoveredIndex].value) - 14)}
              textAnchor="middle"
              className="text-[9px] fill-gray-400"
            >
              {data[hoveredIndex].label}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
