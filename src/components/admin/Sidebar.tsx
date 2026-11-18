"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  LayoutDashboard, CalendarDays, ListChecks, Users, Scissors, Store, Contact, Image as ImageIcon, BellRing, Settings, LogOut, Menu, X, ExternalLink,
} from "lucide-react";
import { locales } from "@/i18n/config";

export type NavItem = { href: string; label: string; icon: keyof typeof icons };
const icons = { LayoutDashboard, CalendarDays, ListChecks, Users, Scissors, Store, Contact, ImageIcon, BellRing, Settings };

export function Sidebar({
  items, salonName, userName, roleLabel, locale, logoutLabel, viewSiteLabel, logoutAction,
}: {
  items: NavItem[]; salonName: string; userName: string; roleLabel: string; locale: string; logoutLabel: string; viewSiteLabel: string;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const content = (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-7 pb-6">
        <p className="font-display text-2xl leading-none text-porcelain">{salonName}</p>
        <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.3em] text-champagne">Dashboard</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Dashboard">
        {items.map((it) => {
          const Icon = icons[it.icon];
          const active = isActive(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                active ? "bg-porcelain/10 font-semibold text-porcelain" : "text-porcelain/65 hover:bg-porcelain/5 hover:text-porcelain",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={1.5} />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 border-t border-porcelain/10 p-4">
        <Link href={`/${locale}`} target="_blank" className="flex items-center gap-2 px-2 text-xs text-porcelain/60 hover:text-porcelain">
          <ExternalLink className="size-3.5" /> {viewSiteLabel}
        </Link>
        <div className="flex gap-1 px-1">
          {locales.map((l) => (
            <a key={l} href={`/admin/locale?l=${l}&back=${encodeURIComponent(pathname)}`}
              className={clsx("rounded-md px-2 py-1 text-[11px] font-semibold uppercase", l === locale ? "bg-porcelain/15 text-porcelain" : "text-porcelain/50 hover:text-porcelain")}>
              {l}
            </a>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-porcelain/5 px-3 py-2.5">
          <Link href="/admin/account" className="min-w-0 hover:opacity-80">
            <p className="truncate text-sm font-medium text-porcelain">{userName}</p>
            <p className="text-[11px] text-champagne">{roleLabel}</p>
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="flex size-8 items-center justify-center rounded-lg text-porcelain/60 hover:bg-porcelain/10 hover:text-porcelain" aria-label={logoutLabel} title={logoutLabel}>
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-espresso lg:block">{content}</aside>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-porcelain/95 px-4 backdrop-blur lg:hidden">
        <p className="font-display text-xl">{salonName}</p>
        <button type="button" onClick={() => setOpen(true)} className="flex size-10 items-center justify-center rounded-lg" aria-label="Menu">
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-fade-in bg-espresso">
            <button type="button" onClick={() => setOpen(false)} className="absolute top-5 right-4 text-porcelain/70" aria-label="Close">
              <X className="size-5" />
            </button>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
