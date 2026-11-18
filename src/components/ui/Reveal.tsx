"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

/** Subtle fade-up when the element scrolls into view (respects reduced motion via CSS). */
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={clsx("transition-all duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]", visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0", className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
