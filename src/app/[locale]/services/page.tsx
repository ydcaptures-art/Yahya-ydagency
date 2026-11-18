import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import { isLocale, pick } from "@/i18n/config";
import { fmt, getDictionary } from "@/i18n/dictionaries";
import { pageContext } from "@/lib/site";
import { getCategories, getServices } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { SmartImage } from "@/components/ui/SmartImage";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: t.meta.servicesTitle, description: t.meta.servicesDescription, alternates: { canonical: `/${locale}/services` } };
}

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t, salon } = await pageContext(params);
  const [categories, services] = await Promise.all([getCategories(salon.id), getServices(salon.id)]);
  const groups = categories
    .map((c) => ({ category: c, items: services.filter((s) => s.category_id === c.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="pt-28 pb-24 lg:pt-36">
      <header className="container-lux max-w-3xl text-center">
        <p className="eyebrow">{t.services.eyebrow}</p>
        <h1 className="heading-xl mt-4">{t.services.title}</h1>
        <p className="mt-6 leading-relaxed text-mocha">{t.services.intro}</p>
      </header>

      <nav
        aria-label={t.services.title}
        className="sticky top-[72px] z-30 mt-12 border-y border-line bg-ivory/90 backdrop-blur-md lg:top-20"
      >
        <div className="container-lux no-scrollbar flex gap-2 overflow-x-auto py-3">
          {groups.map(({ category }) => (
            <a
              key={category.id}
              href={`#${category.slug}`}
              className="shrink-0 rounded-full border border-line px-4 py-2 text-[13px] font-medium whitespace-nowrap transition hover:border-espresso hover:bg-espresso hover:text-porcelain"
            >
              {pick(category.name, locale)}
            </a>
          ))}
        </div>
      </nav>

      <div className="container-lux mt-14 space-y-20">
        {groups.map(({ category, items }) => (
          <section key={category.id} id={category.slug} className="scroll-mt-40">
            <div className="flex items-baseline justify-between gap-4 border-b border-line pb-4">
              <h2 className="heading-md">{pick(category.name, locale)}</h2>
              <span className="text-xs uppercase tracking-[0.16em] text-taupe">{items.length}</span>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {items.map((s) => (
                <article key={s.id} className="group card flex flex-col overflow-hidden transition duration-500 hover:-translate-y-1 hover:shadow-lift">
                  <SmartImage
                    src={s.image_url ?? ""}
                    alt={pick(s.name, locale)}
                    fill
                    sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw"
                    wrapperClassName="aspect-[16/10]"
                    className="transition duration-700 group-hover:scale-105"
                  />
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="font-display text-2xl leading-tight">{pick(s.name, locale)}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-mocha">{pick(s.description, locale)}</p>
                    <div className="mt-6 flex items-end justify-between gap-4 border-t border-line pt-5">
                      <div>
                        <p className="text-lg font-semibold">
                          {s.price_is_from && <span className="mr-1 text-xs font-normal text-taupe">{t.services.from}</span>}
                          {formatMoney(s.price_cents, salon.currency, locale)}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-taupe">
                          <Clock className="size-3.5" strokeWidth={1.5} /> {fmt(t.services.duration, { min: s.duration_minutes })}
                        </p>
                      </div>
                      <Link href={`/${locale}/booking?service=${s.id}`} className="btn-primary px-5 py-2.5">
                        {t.services.bookNow} <ArrowUpRight className="size-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
