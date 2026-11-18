import type { Metadata, Viewport } from "next";
import { display, sans } from "../fonts";
import { notFound } from "next/navigation";
import "../globals.css";
import { isLocale, locales, pick, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSalon, getBranches } from "@/lib/catalog";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { WhatsAppButton } from "@/components/site/WhatsAppButton";
import { MobileBookBar } from "@/components/site/MobileBookBar";
import { whatsappLink } from "@/lib/site";
import { siteUrl } from "@/lib/notifications";


export const dynamic = "force-dynamic";

export const viewport: Viewport = { themeColor: "#fbf8f3", width: "device-width", initialScale: 1 };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const salon = await getSalon();
  const t = getDictionary(locale);
  const base = siteUrl();
  return {
    metadataBase: new URL(base),
    title: { default: `${salon.name} — ${t.meta.homeTitle}`, template: `%s · ${salon.name}` },
    description: t.meta.homeDescription,
    applicationName: salon.name,
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])),
    },
    openGraph: {
      type: "website",
      siteName: salon.name,
      locale,
      title: `${salon.name} — ${pick(salon.tagline, locale)}`,
      description: t.meta.homeDescription,
      images: salon.hero_image_url ? [{ url: salon.hero_image_url, width: 1200, height: 800 }] : undefined,
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;
  const t = getDictionary(l);
  const salon = await getSalon();
  const branches = await getBranches(salon.id);
  const wa = whatsappLink(salon.whatsapp, t.whatsapp.message);

  // Structured data for local SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: salon.name,
    description: pick(salon.about, l),
    url: `${siteUrl()}/${l}`,
    telephone: salon.phone,
    email: salon.email,
    image: salon.hero_image_url,
    sameAs: [salon.instagram_url, salon.facebook_url, salon.tiktok_url].filter(Boolean),
    department: branches.map((b) => ({
      "@type": "BeautySalon",
      name: `${salon.name} ${b.name}`,
      telephone: b.phone,
      address: { "@type": "PostalAddress", streetAddress: b.address, addressLocality: b.city },
      openingHoursSpecification: b.hours
        .filter((h) => !h.is_closed)
        .map((h) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][h.weekday],
          opens: h.open_time,
          closes: h.close_time,
        })),
    })),
  };

  return (
    <html lang={l} className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-espresso focus:px-4 focus:py-2 focus:text-porcelain">
          Skip to content
        </a>
        <Header locale={l} t={t.nav} salonName={salon.name} tagline={pick(salon.tagline, l)} />
        <main id="main">{children}</main>
        <Footer locale={l} t={t} salon={salon} branches={branches} />
        {wa ? <WhatsAppButton href={wa} label={t.whatsapp.label} /> : null}
        <MobileBookBar locale={l} label={t.nav.bookAppointment} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      </body>
    </html>
  );
}
