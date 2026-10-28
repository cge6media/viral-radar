/**
 * Hand-rolled SVG charts (no chart library): sparkline, horizontal bar chart with hover tooltip,
 * grouped scenario bars. Thin marks, recessive grid, text in ink tokens.
 */
import { useState, type ReactNode } from 'react';

export function Sparkline({ points, width = 120, height = 32, color = 'var(--momentum)' }: { points: { t: string; v: number }[]; width?: number; height?: number; color?: string }) {
  if (points.length < 2) {
    return (
      <svg className="spark" width={width} height={height} aria-label="Not enough history for a trend line">
        <circle cx={width - 4} cy={height / 2} r={3} fill={color} />
        <line x1={4} y1={height / 2} x2={width - 8} y2={height / 2} stroke="var(--line-strong)" strokeDasharray="2 3" />
      </svg>
    );
  }
  const xs = points.map((_, i) => 4 + (i * (width - 8)) / (points.length - 1));
  const vals = points.map((p) => p.v);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const y = (v: number) => (hi === lo ? height / 2 : height - 4 - ((v - lo) / (hi - lo)) * (height - 8));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${xs[i].toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  return (
    <svg className="spark" width={width} height={height} aria-label={`Momentum over ${points.length} runs: ${vals[0]} → ${vals[vals.length - 1]}`}>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xs[xs.length - 1]} cy={y(vals[vals.length - 1])} r={3} fill={color} stroke="var(--surface-1)" strokeWidth={2} />
    </svg>
  );
}

export interface BarDatum { label: string; value: number; color?: string; href?: string; tip?: ReactNode }

/** Horizontal bars, baseline-anchored, 4px rounded data-end, 2px surface gap. One series → no legend. */
export function HBarChart({ data, max, unit = '', height = 26, valueFmt }: { data: BarDatum[]; max?: number; unit?: string; height?: number; valueFmt?: (v: number) => string }) {
  const [tip, setTip] = useState<{ x: number; y: number; node: ReactNode } | null>(null);
  const m = max ?? Math.max(1, ...data.map((d) => d.value));
  const labelW = 150;
  const valW = 56;
  const W = 600;
  const plotW = W - labelW - valW - 8;
  const H = data.length * height + 6;
  const fmt = valueFmt || ((v: number) => `${Math.round(v)}${unit}`);
  return (
    <div style={{ position: 'relative' }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: H }} role="img" aria-label="Bar chart">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} className="grid-line" x1={labelW + f * plotW} x2={labelW + f * plotW} y1={0} y2={H} />
        ))}
        <line className="axis" x1={labelW} x2={labelW} y1={0} y2={H} />
        {data.map((d, i) => {
          const y = 3 + i * height;
          const w = Math.max(2, (d.value / m) * plotW);
          const bh = height - 8;
          const inner = (
            <g
              key={d.label}
              onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, node: d.tip ?? `${d.label}: ${fmt(d.value)}` })}
              onMouseMove={(e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))}
              onMouseLeave={() => setTip(null)}
              style={{ cursor: d.href ? 'pointer' : 'default' }}
            >
              <rect x={0} y={y - 2} width={W} height={height - 2} fill="transparent" />
              <text className="lbl" x={labelW - 8} y={y + bh / 2 + 4} textAnchor="end">{truncate(d.label, 22)}</text>
              <path d={`M${labelW + 1},${y} h${w - 4} a4,4 0 0 1 4,4 v${bh - 8} a4,4 0 0 1 -4,4 h-${w - 4} z`} fill={d.color || 'var(--momentum)'} />
              <text className="val" x={labelW + w + 8} y={y + bh / 2 + 4}>{fmt(d.value)}</text>
            </g>
          );
          return d.href ? <a key={d.label} href={d.href}>{inner}</a> : inner;
        })}
      </svg>
      {tip && <div className="tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }}>{tip.node}</div>}
    </div>
  );
}

/** Grouped vertical bars for Low / Base / High scenarios (3 series fixed order, legend + direct labels). */
export function ScenarioBars({ groups, fmt }: { groups: { label: string; values: { name: string; value: number; color: string }[] }[]; fmt: (v: number) => string }) {
  const [tip, setTip] = useState<{ x: number; y: number; node: ReactNode } | null>(null);
  const W = 640, H = 220, padL = 56, padB = 34, padT = 14;
  const all = groups.flatMap((g) => g.values.map((v) => v.value));
  const maxV = Math.max(1, ...all);
  const minV = Math.min(0, ...all);
  const plotH = H - padB - padT;
  const scale = (v: number) => padT + plotH - ((v - minV) / (maxV - minV)) * plotH;
  const zero = scale(0);
  const gw = (W - padL - 10) / groups.length;
  const bw = Math.min(28, (gw - 16) / 3);
  const ticks = niceTicks(minV, maxV, 4);
  return (
    <div style={{ position: 'relative' }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue scenarios">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={padL} x2={W - 6} y1={scale(t)} y2={scale(t)} />
            <text x={padL - 6} y={scale(t) + 4} textAnchor="end">{fmt(t)}</text>
          </g>
        ))}
        <line className="axis" x1={padL} x2={W - 6} y1={zero} y2={zero} />
        {groups.map((g, gi) => (
          <g key={g.label}>
            {g.values.map((v, vi) => {
              const x = padL + gi * gw + (gw - (bw * 3 + 4)) / 2 + vi * (bw + 2);
              const top = Math.min(zero, scale(v.value));
              const h = Math.max(2, Math.abs(zero - scale(v.value)));
              return (
                <rect
                  key={v.name}
                  x={x}
                  y={top}
                  width={bw}
                  height={h}
                  rx={3}
                  fill={v.color}
                  onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, node: `${g.label} · ${v.name}: ${fmt(v.value)}` })}
                  onMouseMove={(e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))}
                  onMouseLeave={() => setTip(null)}
                />
              );
            })}
            <text x={padL + gi * gw + gw / 2} y={H - 12} textAnchor="middle">{g.label}</text>
          </g>
        ))}
      </svg>
      {tip && <div className="tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }}>{tip.node}</div>}
    </div>
  );
}

function niceTicks(min: number, max: number, n: number): number[] {
  const span = max - min || 1;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
