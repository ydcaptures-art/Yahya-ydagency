"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Menu, X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Header({
  locale,
  t,
  salonName,
  tagline,
}: {
  locale: Locale;
  t: Dictionary["nav"];
  salonName: string;
  tagline: string;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const isHome = pathname === `/${locale}`;
  const transparent = isHome && !scrolled && !open;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const links = [
    { href: `/${locale}`, label: t.home },
    { href: `/${locale}/services`, label: t.services },
    { href: `/${locale}#team`, label: t.team },
    { href: `/${locale}#gallery`, label: t.gallery },
    { href: `/${locale}#contact`, label: t.contact },
  ];

  return (
    <header
      className={clsx(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        transparent ? "bg-transparent text-porcelain" : "border-b border-line/70 bg-ivory/95 text-espresso backdrop-blur-md",
      )}
    >
      <div className="container-lux flex h-[72px] items-center justify-between gap-6 lg:h-20">
        <Link href={`/${locale}`} className="group flex flex-col leading-none" aria-label={salonName}>
          <span className="font-display text-[1.65rem] font-medium tracking-[0.04em]">{salonName}</span>
          <span className={clsx("mt-1 text-[9px] font-semibold uppercase tracking-[0.34em]", transparent ? "text-porcelain/75" : "text-gold-dark")}>
            {tagline}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="link-underline text-[13px] font-medium tracking-wide">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <LanguageSwitcher locale={locale} label={t.language} light={transparent} />
          <Link href={`/${locale}/booking`} className={clsx("hidden sm:inline-flex", transparent ? "btn-ghost-light" : "btn-primary")}>
            {t.bookAppointment}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-full lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t.close : t.menu}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <div
        id="mobile-menu"
        className={clsx(
          "fixed inset-x-0 top-[72px] bottom-0 bg-ivory px-6 pt-6 pb-28 transition-all duration-500 lg:hidden",
          open ? "visible opacity-100" : "invisible -translate-y-2 opacity-0",
        )}
      >
        <nav className="flex flex-col" aria-label="Mobile">
          {links.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="border-b border-line py-5 font-display text-3xl text-espresso"
              style={{ transitionDelay: `${i * 40}ms` }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href={`/${locale}/booking`} className="btn-primary mt-8 w-full py-4">
          {t.bookAppointment}
        </Link>
      </div>
    </header>
  );
}
