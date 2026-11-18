"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarHeart } from "lucide-react";

/** Sticky "Book now" bar on mobile — hidden inside the booking flow itself. */
export function MobileBookBar({ locale, label }: { locale: string; label: string }) {
  const pathname = usePathname();
  if (pathname.startsWith(`/${locale}/booking`)) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ivory/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden">
      <Link href={`/${locale}/booking`} className="btn-primary w-full py-4 text-[15px]">
        <CalendarHeart className="size-4.5" strokeWidth={1.6} />
        {label}
      </Link>
    </div>
  );
}
