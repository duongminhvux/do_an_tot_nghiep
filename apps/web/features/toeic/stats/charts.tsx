'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

// Reference categorical slots 1-3 (validated all-pairs for line charts).
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a'] as const;

const AXIS = '#94a3b8';
const GRID = '#e2e8f0';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry?.contentRect.width ?? 0),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(value));
  const nice = [1, 2, 2.5, 5, 10].find((n) => n * step >= value) ?? 10;
  return nice * step;
}

// Show at most ~7 x labels so they never collide.
function labelEvery(count: number, width: number) {
  return Math.max(1, Math.ceil(count / Math.max(2, Math.floor(width / 70))));
}

function Tooltip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 80), Math.max(80, width - 80));
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
      style={{ left }}
    >
      {children}
    </div>
  );
}

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
}

export function LineChart({
  labels,
  tooltipLabels,
  series,
  max = 100,
  height = 260,
  format = (v) => `${v}`,
}: {
  labels: string[];
  tooltipLabels?: string[];
  series: LineSeries[];
  max?: number;
  height?: number;
  format?: (value: number) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 12, right: 12, bottom: 28, left: 40 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const n = labels.length;
  const x = (i: number) => pad.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => pad.top + plotH - (Math.min(v, max) / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => r * max);
  const every = labelEvery(n, plotW);

  const onMove = (event: React.MouseEvent<SVGRectElement>) => {
    if (!n) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left) / bounds.width;
    setHover(Math.round(Math.min(1, Math.max(0, ratio)) * (n - 1)));
  };

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={GRID} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS}>
                {format(t)}
              </text>
            </g>
          ))}
          {labels.map((label, i) =>
            i % every === 0 || i === n - 1 ? (
              <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={11} fill={AXIS}>
                {label}
              </text>
            ) : null,
          )}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + plotH} stroke={AXIS} strokeDasharray="3 3" />
          )}
          {series.map((s) => {
            const points = s.values
              .map((v, i) => (v == null ? null : ([x(i), y(v)] as const)))
              .filter((p): p is readonly [number, number] => p !== null);
            return (
              <g key={s.key}>
                <polyline
                  points={points.map((p) => p.join(',')).join(' ')}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {points.length <= 31 &&
                  points.map(([px, py], i) => (
                    <circle key={i} cx={px} cy={py} r={3} fill={s.color} stroke="#fff" strokeWidth={2} />
                  ))}
                {hover !== null && s.values[hover] != null && (
                  <circle cx={x(hover)} cy={y(s.values[hover]!)} r={5} fill={s.color} stroke="#fff" strokeWidth={2} />
                )}
              </g>
            );
          })}
          <rect
            x={pad.left}
            y={pad.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={x(hover)} width={width}>
          <p className="mb-1 font-semibold text-slate-700">{(tooltipLabels ?? labels)[hover]}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center gap-2 text-slate-600">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}:
              <span className="font-semibold text-slate-900">
                {s.values[hover] == null ? '—' : format(s.values[hover]!)}
              </span>
            </p>
          ))}
        </Tooltip>
      )}
    </div>
  );
}

export function BarChart({
  labels,
  values,
  color = SERIES_COLORS[0],
  max,
  height = 220,
  format = (v) => `${v}`,
  tooltip,
}: {
  labels: string[];
  values: number[];
  color?: string;
  max?: number;
  height?: number;
  format?: (value: number) => string;
  tooltip?: (index: number) => ReactNode;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 12, right: 8, bottom: 28, left: 40 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const n = values.length;
  const top = max ?? niceMax(Math.max(0, ...values));
  const slot = n ? plotW / n : 0;
  const barW = Math.max(2, Math.min(28, slot - 2));
  const y = (v: number) => pad.top + plotH - (Math.min(v, top) / top) * plotH;
  const ticks = [0, 0.5, 1].map((r) => r * top);
  const every = labelEvery(n, plotW);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={GRID} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS}>
                {format(t)}
              </text>
            </g>
          ))}
          {values.map((v, i) => {
            const cx = pad.left + slot * i + slot / 2;
            const h = Math.max(0, pad.top + plotH - y(v));
            const r = Math.min(4, barW / 2, h);
            return (
              <g
                key={i}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <rect x={cx - slot / 2} y={pad.top} width={slot} height={plotH} fill="transparent" />
                {h > 0 && (
                  <path
                    d={`M${cx - barW / 2},${pad.top + plotH} V${y(v) + r} q0,-${r} ${r},-${r} H${cx + barW / 2 - r} q${r},0 ${r},${r} V${pad.top + plotH} Z`}
                    fill={color}
                    opacity={hover === null || hover === i ? 1 : 0.55}
                  />
                )}
                {(i % every === 0 || i === n - 1) && (
                  <text x={cx} y={height - 8} textAnchor="middle" fontSize={11} fill={AXIS}>
                    {labels[i]}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={pad.left + slot * hover + slot / 2} width={width}>
          {tooltip ? tooltip(hover) : (
            <>
              <p className="font-semibold text-slate-700">{labels[hover]}</p>
              <p className="font-semibold text-slate-900">{format(values[hover] ?? 0)}</p>
            </>
          )}
        </Tooltip>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: item.color, height: 3 }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
