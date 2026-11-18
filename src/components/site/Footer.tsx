import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { pick } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Branch, Salon } from "@/lib/catalog";
import { InstagramIcon, FacebookIcon, TikTokIcon } from "@/components/ui/SocialIcons";

export function Footer({ locale, t, salon, branches }: { locale: Locale; t: Dictionary; salon: Salon; branches: Branch[] }) {
  const year = new Date().getFullYear();
  const socials = [
    { href: salon.instagram_url, label: "Instagram", Icon: InstagramIcon },
    { href: salon.facebook_url, label: "Facebook", Icon: FacebookIcon },
    { href: salon.tiktok_url, label: "TikTok", Icon: TikTokIcon },
  ].filter((s) => s.href);

  return (
    <footer className="bg-espresso pb-28 text-porcelain/80 sm:pb-0">
      <div className="container-lux grid gap-12 py-16 md:grid-cols-12 lg:py-20">
        <div className="md:col-span-4">
          <p className="font-display text-3xl tracking-[0.04em] text-porcelain">{salon.name}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.34em] text-champagne">{pick(salon.tagline, locale)}</p>
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-porcelain/60">{pick(salon.about, locale).split(".")[0]}.</p>
          <Link href={`/${locale}/booking`} className="btn-gold mt-8">
            {t.nav.bookAppointment}
          </Link>
        </div>

        <div className="md:col-span-2">
          <p className="eyebrow !text-champagne">{t.footer.explore}</p>
          <ul className="mt-5 space-y-3 text-sm">
            <li><Link className="link-underline hover:text-porcelain" href={`/${locale}`}>{t.nav.home}</Link></li>
            <li><Link className="link-underline hover:text-porcelain" href={`/${locale}/services`}>{t.nav.services}</Link></li>
            <li><Link className="link-underline hover:text-porcelain" href={`/${locale}/booking`}>{t.nav.book}</Link></li>
            <li><Link className="link-underline hover:text-porcelain" href={`/${locale}#gallery`}>{t.nav.gallery}</Link></li>
          </ul>
        </div>

        <div className="md:col-span-4" id="footer-contact">
          <p className="eyebrow !text-champagne">{t.footer.contact}</p>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            {branches.map((b) => (
              <address key={b.id} className="text-sm not-italic leading-relaxed">
                <span className="block font-medium text-porcelain">{b.name}</span>
                {b.address}
                <br />
                {b.city}
                {b.phone && (
                  <a href={`tel:${b.phone.replace(/\s/g, "")}`} className="mt-1 flex items-center gap-2 hover:text-porcelain">
                    <Phone className="size-3.5" strokeWidth={1.5} /> {b.phone}
                  </a>
                )}
              </address>
            ))}
          </div>
          {salon.email && (
            <a href={`mailto:${salon.email}`} className="mt-6 flex items-center gap-2 text-sm hover:text-porcelain">
              <Mail className="size-3.5" strokeWidth={1.5} /> {salon.email}
            </a>
          )}
        </div>

        <div className="md:col-span-2">
          <p className="eyebrow !text-champagne">{t.footer.follow}</p>
          <div className="mt-5 flex gap-3">
            {socials.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href!}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex size-11 items-center justify-center rounded-full border border-porcelain/20 transition hover:border-champagne hover:text-champagne"
              >
                <Icon className="size-[18px]" />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-porcelain/10">
        <div className="container-lux flex flex-col items-center justify-between gap-3 py-6 text-xs text-porcelain/50 sm:flex-row">
          <p>
            © {year} {salon.name}. {t.footer.rights}
          </p>
          <div className="flex items-center gap-5">
            <Link href="/admin" className="hover:text-porcelain/80" rel="nofollow">
              {t.footer.staffLogin}
            </Link>
            {process.env.NEXT_PUBLIC_AGENCY_URL ? (
              <a
                href={process.env.NEXT_PUBLIC_AGENCY_URL}
                target="_blank"
                rel="noopener"
                className="tracking-wide text-porcelain/40 transition hover:text-champagne"
              >
                {t.footer.credit}
              </a>
            ) : (
              <span className="tracking-wide text-porcelain/40">{t.footer.credit}</span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
