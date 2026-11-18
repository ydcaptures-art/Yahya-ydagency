"use client";
import { useState } from "react";
import { SmartImage } from "@/components/ui/SmartImage";

export function BeforeAfter({ before, after, labelBefore, labelAfter, caption }: {
  before: string; after: string; labelBefore: string; labelAfter: string; caption: string;
}) {
  const [pos, setPos] = useState(50);
  return (
    <figure>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] select-none">
        <SmartImage src={after} alt={`${caption} — ${labelAfter}`} fill sizes="(min-width: 768px) 40vw, 100vw" wrapperClassName="absolute inset-0" />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <SmartImage src={before} alt={`${caption} — ${labelBefore}`} fill sizes="(min-width: 768px) 40vw, 100vw" wrapperClassName="absolute inset-0" className="grayscale-[30%]" />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-px bg-porcelain shadow" style={{ left: `${pos}%` }}>
          <span className="absolute top-1/2 left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-porcelain text-espresso shadow-lift">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m9 6-6 6 6 6M15 6l6 6-6 6" /></svg>
          </span>
        </div>
        <span className="absolute top-4 left-4 rounded-full bg-espresso/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-porcelain backdrop-blur">{labelBefore}</span>
        <span className="absolute top-4 right-4 rounded-full bg-porcelain/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-espresso backdrop-blur">{labelAfter}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label={`${labelBefore} / ${labelAfter}`}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>
      <figcaption className="mt-4 font-display text-xl">{caption}</figcaption>
    </figure>
  );
}
