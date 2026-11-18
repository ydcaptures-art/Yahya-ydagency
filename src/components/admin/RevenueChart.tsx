"use client";
import { useState } from "react";

/**
 * Single-series column chart (no legend needed — the panel title names it).
 * Thin columns, 4px rounded data-ends, hairline grid, hover tooltip, table fallback.
 */

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export function RevenueChart({ data, currency, locale, caption }: { data: { label: string; full: string; value: number }[]; currency: string; locale: string; caption: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const fmt = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0, notation: v >= 10000 ? "compact" : "standard" }).format(v);
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const W = 640, H = 220, padL = 78, padB = 26, padT = 10;
  const plotW = W - padL - 8, plotH = H - padB - padT;
  const band = plotW / data.length;
  const barW = Math.min(24, band - 6);
  const ticks = [0, max / 2, max];
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={caption}>
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={padL} x2={W - 8} y1={y(tk)} y2={y(tk)} stroke="#ece4d8" strokeWidth={1} />
            <text x={padL - 8} y={y(tk) + 4} textAnchor="end" fontSize="10" fill="#9a8676">{fmt(tk / 100)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = Math.max(0, (d.value / max) * plotH);
          const x = padL + i * band + (band - barW) / 2;
          const r = Math.min(4, h);
          const top = padT + plotH - h;
          return (
            <g key={d.full} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + i * band} y={padT} width={band} height={plotH} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${padT + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${padT + plotH} Z`}
                  fill="var(--color-chart)"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {(i % 2 === 0 || data.length <= 8) && (
                <text x={padL + i * band + band / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#9a8676">{d.label}</text>
              )}
            </g>
          );
        })}
        <line x1={padL} x2={W - 8} y1={padT + plotH} y2={padT + plotH} stroke="#d9cdbd" strokeWidth={1} />
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-espresso px-3 py-2 text-xs text-porcelain shadow-lift"
          style={{ left: `${((padL + hover * band + band / 2) / W) * 100}%`, top: `${(y(data[hover].value) / H) * 100}%` }}
        >
          <p className="text-porcelain/70">{data[hover].full}</p>
          <p className="font-semibold">{fmt(data[hover].value / 100)}</p>
        </div>
      )}
      <details className="mt-2 text-xs text-taupe">
        <summary className="cursor-pointer">Table</summary>
        <table className="mt-2 w-full">
          <tbody>
            {data.map((d) => (
              <tr key={d.full} className="border-b border-line"><td className="py-1">{d.full}</td><td className="py-1 text-right tabular-nums">{fmt(d.value / 100)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
