import { useState, useRef, useEffect, useCallback } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
  formatValue?: (value: number) => string;
}

// Default euro formatter
const defaultFormat = (v: number) => `€${(v / 100).toFixed(2).replace('.', ',')}`;

export function LineChart({ data, color = '#8B5CF6', height = 200, formatValue = defaultFormat }: LineChartProps) {
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

  const padding = { top: 20, right: 12, bottom: 30, left: 12 };
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
  const minValue = 0;
  const valueRange = maxValue - minValue || 1;

  // Calculate point positions
  const getX = (i: number) => padding.left + (data.length > 1 ? (i / (data.length - 1)) * chartWidth : chartWidth / 2);
  const getY = (v: number) => padding.top + chartHeight - ((v - minValue) / valueRange) * chartHeight;

  // Build polyline points
  const points = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ');

  // Build area path (filled polygon under the line)
  const areaPath = `M ${getX(0)},${getY(data[0].value)} ` +
    data.map((d, i) => `L ${getX(i)},${getY(d.value)}`).join(' ') +
    ` L ${getX(data.length - 1)},${padding.top + chartHeight} L ${getX(0)},${padding.top + chartHeight} Z`;

  const gradientId = `lineGrad-${color.replace('#', '')}`;

  // Handle mouse / touch interaction
  const handleInteraction = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el || data.length === 0) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left - padding.left;
    const stepWidth = chartWidth / Math.max(data.length - 1, 1);
    const index = Math.round(x / stepWidth);
    setHoveredIndex(Math.max(0, Math.min(data.length - 1, index)));
  }, [data.length, chartWidth, padding.left]);

  // Y-axis gridlines (4 lines)
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    y: padding.top + chartHeight * (1 - pct),
    value: minValue + valueRange * pct,
  }));

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
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {gridLines.map((line, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={line.y}
              x2={width - padding.right}
              y2={line.y}
              stroke="#F1F5F9"
              strokeWidth="1"
            />
          </g>
        ))}

        {/* Filled area */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data point dots */}
        {data.length <= 31 && data.map((d, i) => (
          <circle
            key={i}
            cx={getX(i)}
            cy={getY(d.value)}
            r={hoveredIndex === i ? 5 : 3}
            fill={hoveredIndex === i ? color : 'white'}
            stroke={color}
            strokeWidth="2"
            className="transition-all duration-150"
          />
        ))}

        {/* X-axis labels (show ~6 evenly spaced) */}
        {data.length > 0 && (() => {
          const step = Math.max(1, Math.floor(data.length / 6));
          const indices = [];
          for (let i = 0; i < data.length; i += step) indices.push(i);
          if (indices[indices.length - 1] !== data.length - 1) indices.push(data.length - 1);
          return indices.map(i => (
            <text
              key={i}
              x={getX(i)}
              y={height - 4}
              textAnchor="middle"
              className="text-[10px] fill-gray-400"
            >
              {data[i].label}
            </text>
          ));
        })()}

        {/* Hover tooltip */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <g>
            {/* Vertical guide line */}
            <line
              x1={getX(hoveredIndex)}
              y1={padding.top}
              x2={getX(hoveredIndex)}
              y2={padding.top + chartHeight}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.4"
            />
            {/* Tooltip background */}
            <rect
              x={Math.min(getX(hoveredIndex) - 50, width - 112)}
              y={Math.max(getY(data[hoveredIndex].value) - 44, 0)}
              width="100"
              height="36"
              rx="8"
              fill="#1E293B"
              opacity="0.95"
            />
            {/* Tooltip value */}
            <text
              x={Math.min(getX(hoveredIndex), width - 62)}
              y={Math.max(getY(data[hoveredIndex].value) - 24, 16)}
              textAnchor="middle"
              className="text-[12px] fill-white font-bold"
            >
              {formatValue(data[hoveredIndex].value)}
            </text>
            {/* Tooltip label */}
            <text
              x={Math.min(getX(hoveredIndex), width - 62)}
              y={Math.max(getY(data[hoveredIndex].value) - 12, 28)}
              textAnchor="middle"
              className="text-[10px] fill-gray-400"
            >
              {data[hoveredIndex].label}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
