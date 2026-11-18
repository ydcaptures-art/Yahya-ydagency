"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Globe } from "lucide-react";
import { locales, localeNames, type Locale } from "@/i18n/config";

export function LanguageSwitcher({ locale, label, light }: { locale: Locale; label: string; light?: boolean }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const hrefFor = (l: Locale) => {
    const parts = pathname.split("/");
    parts[1] = l;
    const qs = search.toString();
    return parts.join("/") + (qs ? `?${qs}` : "");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold uppercase tracking-[0.14em] transition",
          light ? "hover:bg-porcelain/10" : "hover:bg-cream",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <Globe className="size-4" strokeWidth={1.5} />
        {locale}
        <ChevronDown className={clsx("size-3.5 transition", open && "rotate-180")} />
      </button>
      {open && (
        <ul role="listbox" className="card absolute right-0 mt-2 w-44 animate-fade-in overflow-hidden p-1.5 text-espresso">
          {locales.map((l) => (
            <li key={l}>
              {/* Full navigation so server components re-render in the new language */}
              <a
                href={hrefFor(l)}
                role="option"
                aria-selected={l === locale}
                hrefLang={l}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-cream"
              >
                {localeNames[l]}
                {l === locale && <Check className="size-4 text-gold-dark" />}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
