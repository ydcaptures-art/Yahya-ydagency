import Link from "next/link";
import { ArrowRight, ArrowUpRight, Clock, MapPin, Phone, Star, Sparkles, Gem, MessagesSquare, CalendarCheck2 } from "lucide-react";
import { pick } from "@/i18n/config";
import { fmt } from "@/i18n/dictionaries";
import { pageContext } from "@/lib/site";
import { getBranches, getServices, getEmployees, getPublicContent } from "@/lib/catalog";
import { getInstagramPosts } from "@/lib/instagram";
import { formatMoney } from "@/lib/money";
import { formatDateKey, toDateKey, weekdayOf } from "@/lib/time";
import { SmartImage } from "@/components/ui/SmartImage";
import { Reveal } from "@/components/ui/Reveal";
import { BeforeAfter } from "@/components/site/BeforeAfter";
import { InstagramIcon } from "@/components/ui/SocialIcons";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t, salon } = await pageContext(params);
  const [branches, services, employees, content, igPosts] = await Promise.all([
    getBranches(salon.id),
    getServices(salon.id),
    getEmployees(salon.id),
    getPublicContent(salon.id),
    getInstagramPosts(6),
  ]);
  const featured = services.filter((s) => s.is_featured).slice(0, 6);
  const team = employees.filter((e) => e.is_bookable);
  const gallery = content.gallery.filter((g) => g.kind === "gallery");
  const beforeAfter = content.gallery.filter((g) => g.kind === "before_after" && g.before_image_url);
  const todayWeekday = weekdayOf(toDateKey(new Date(), salon.timezone));
  const stats = salon.trust_stats ?? {};
  const h = t.home;
  const whyIcons = [Gem, Sparkles, MessagesSquare, CalendarCheck2];
  const nf = new Intl.NumberFormat(locale);

  return (
    <>
      {/* HERO ------------------------------------------------------------ */}
      <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-espresso text-porcelain">
        <SmartImage
          src={salon.hero_image_url ?? ""}
          alt={salon.name}
          fill
          priority
          sizes="100vw"
          wrapperClassName="absolute inset-0 -z-10"
          className="scale-[1.02]"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/85 via-ink/35 to-ink/40" />
        <div className="container-lux pt-32 pb-16 sm:pb-24 lg:pb-28">
          <div className="max-w-3xl animate-fade-up">
            <p className="eyebrow !text-champagne">{pick(salon.tagline, locale) || h.heroEyebrow}</p>
            <h1 className="heading-xl mt-5 text-balance">{h.heroTitle}</h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-porcelain/80 sm:text-lg">{h.heroText}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href={`/${locale}/booking`} className="btn-gold px-8 py-4 text-[15px]">
                {t.nav.bookAppointment} <ArrowRight className="size-4" />
              </Link>
              <Link href={`/${locale}/services`} className="btn-ghost-light px-8 py-4 text-[15px]">
                {h.heroSecondary}
              </Link>
            </div>
          </div>
          {(stats.rating || stats.clients || stats.years) && (
            <dl className="mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-porcelain/20 pt-8">
              {stats.rating ? (
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-porcelain/60">{h.trustRating}</dt>
                  <dd className="mt-1 flex items-center gap-1.5 font-display text-3xl sm:text-4xl">
                    {stats.rating.toLocaleString(locale)} <Star className="size-5 fill-champagne text-champagne" />
                  </dd>
                </div>
              ) : null}
              {stats.clients ? (
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-porcelain/60">{h.trustClients}</dt>
                  <dd className="mt-1 font-display text-3xl sm:text-4xl">{nf.format(stats.clients)}+</dd>
                </div>
              ) : null}
              {stats.years ? (
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-porcelain/60">{h.trustYears}</dt>
                  <dd className="mt-1 font-display text-3xl sm:text-4xl">{stats.years}</dd>
                </div>
              ) : null}
            </dl>
          )}
        </div>
      </section>

      {/* FEATURED SERVICES ------------------------------------------------ */}
      <section className="py-20 sm:py-28">
        <div className="container-lux">
          <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">{h.featuredEyebrow}</p>
              <h2 className="heading-lg mt-4 max-w-xl text-balance">{h.featuredTitle}</h2>
            </div>
            <Link href={`/${locale}/services`} className="link-underline inline-flex items-center gap-2 text-sm font-medium">
              {h.viewAllServices} <ArrowRight className="size-4" />
            </Link>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((s, i) => (
              <Reveal key={s.id} delay={(i % 3) * 90}>
                <article className="group card overflow-hidden transition duration-500 hover:-translate-y-1 hover:shadow-lift">
                  <SmartImage
                    src={s.image_url ?? ""}
                    alt={pick(s.name, locale)}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    wrapperClassName="aspect-[4/3]"
                    className="transition duration-700 group-hover:scale-105"
                  />
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-display text-2xl leading-tight">{pick(s.name, locale)}</h3>
                      <p className="shrink-0 text-right text-sm">
                        {s.price_is_from && <span className="block text-[10px] uppercase tracking-[0.16em] text-taupe">{t.services.from}</span>}
                        <span className="font-semibold">{formatMoney(s.price_cents, salon.currency, locale)}</span>
                      </p>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-mocha">{pick(s.description, locale)}</p>
                    <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                      <span className="flex items-center gap-1.5 text-xs text-taupe">
                        <Clock className="size-3.5" strokeWidth={1.5} /> {fmt(t.services.duration, { min: s.duration_minutes })}
                      </span>
                      <Link href={`/${locale}/booking?service=${s.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-gold-dark hover:text-espresso">
                        {t.services.bookNow} <ArrowUpRight className="size-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US ------------------------------------------------------------ */}
      <section className="bg-cream py-20 sm:py-28">
        <div className="container-lux grid items-center gap-14 lg:grid-cols-2">
          <Reveal className="relative">
            <SmartImage
              src={branches[0]?.image_url ?? salon.hero_image_url ?? ""}
              alt={salon.name}
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              wrapperClassName="aspect-[4/5] rounded-[var(--radius-card)]"
            />
            <div className="card absolute -right-3 -bottom-6 max-w-[15rem] p-5 sm:-right-8">
              <p className="font-display text-xl leading-snug italic">“{pick(content.testimonials[0]?.body, locale).split(".")[0]}.”</p>
              <p className="mt-3 text-xs uppercase tracking-[0.16em] text-taupe">— {content.testimonials[0]?.author}</p>
            </div>
          </Reveal>
          <div>
            <Reveal>
              <p className="eyebrow">{h.whyEyebrow}</p>
              <h2 className="heading-lg mt-4">{h.whyTitle}</h2>
              <p className="mt-6 max-w-lg leading-relaxed text-mocha">{pick(salon.about, locale)}</p>
            </Reveal>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              {h.why.map((w, i) => {
                const Icon = whyIcons[i % whyIcons.length];
                return (
                  <Reveal key={w.title} delay={i * 80}>
                    <Icon className="size-6 text-gold-dark" strokeWidth={1.25} />
                    <h3 className="mt-4 font-display text-xl">{w.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-mocha">{w.text}</p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* TEAM ---------------------------------------------------------------- */}
      <section id="team" className="scroll-mt-20 py-20 sm:py-28">
        <div className="container-lux">
          <Reveal className="text-center">
            <p className="eyebrow">{t.nav.team}</p>
            <h2 className="heading-lg mt-4">{salon.name}</h2>
          </Reveal>
          <div className="no-scrollbar -mx-5 mt-12 flex snap-x gap-5 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
            {team.map((e, i) => (
              <Reveal key={e.id} delay={i * 60} className="w-44 shrink-0 snap-start sm:w-auto">
                <SmartImage
                  src={e.photo_url ?? ""}
                  alt={`${e.first_name} ${e.last_name}`}
                  fill
                  sizes="(min-width: 1024px) 16vw, 45vw"
                  wrapperClassName="aspect-[3/4] rounded-2xl"
                />
                <p className="mt-4 font-display text-xl">{e.first_name} {e.last_name.charAt(0)}.</p>
                <p className="text-xs uppercase tracking-[0.14em] text-taupe">{pick(e.title, locale)}</p>
                <p className="mt-0.5 text-xs text-mocha">{branches.find((b) => b.id === e.branch_id)?.name}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* GALLERY ------------------------------------------------------------- */}
      <section id="gallery" className="scroll-mt-20 bg-espresso py-20 text-porcelain sm:py-28">
        <div className="container-lux">
          <Reveal>
            <p className="eyebrow !text-champagne">{h.galleryEyebrow}</p>
            <h2 className="heading-lg mt-4">{h.galleryTitle}</h2>
          </Reveal>
          <div className="mt-12 grid auto-rows-[180px] grid-cols-2 gap-3 sm:auto-rows-[240px] sm:gap-4 lg:grid-cols-4">
            {gallery.slice(0, 6).map((g, i) => (
              <Reveal
                key={g.id}
                delay={i * 60}
                className={i === 0 ? "col-span-2 row-span-2" : i === 3 ? "row-span-2" : ""}
              >
                <figure className="group relative h-full overflow-hidden rounded-2xl">
                  <SmartImage src={g.image_url} alt={pick(g.caption, locale)} fill sizes="(min-width: 1024px) 50vw, 100vw" wrapperClassName="absolute inset-0" className="transition duration-700 group-hover:scale-105" />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-4 text-sm opacity-0 transition group-hover:opacity-100">
                    {pick(g.caption, locale)}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>

          {beforeAfter.length > 0 && (
            <div className="mt-24">
              <Reveal>
                <p className="eyebrow !text-champagne">{h.beforeAfterEyebrow}</p>
                <h2 className="heading-lg mt-4">{h.beforeAfterTitle}</h2>
              </Reveal>
              <div className="mt-12 grid gap-10 md:grid-cols-2">
                {beforeAfter.slice(0, 2).map((g) => (
                  <BeforeAfter
                    key={g.id}
                    before={g.before_image_url!}
                    after={g.image_url}
                    labelBefore={h.before}
                    labelAfter={h.after}
                    caption={pick(g.caption, locale)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* TESTIMONIALS --------------------------------------------------------- */}
      <section className="py-20 sm:py-28">
        <div className="container-lux">
          <Reveal className="text-center">
            <p className="eyebrow">{h.testimonialsEyebrow}</p>
            <h2 className="heading-lg mt-4">{h.testimonialsTitle}</h2>
            {stats.rating && stats.reviews ? (
              <p className="mt-4 inline-flex items-center gap-2 text-sm text-mocha">
                <span className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-4 fill-gold text-gold" />)}</span>
                {stats.rating.toLocaleString(locale)} · {nf.format(stats.reviews)}
              </p>
            ) : null}
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {content.testimonials.map((r, i) => (
              <Reveal key={r.id} delay={i * 80}>
                <blockquote className="card flex h-full flex-col p-7">
                  <span className="flex" aria-label={`${r.rating}/5`}>
                    {Array.from({ length: r.rating }).map((_, k) => <Star key={k} className="size-3.5 fill-gold text-gold" />)}
                  </span>
                  <p className="mt-5 flex-1 font-display text-[1.3rem] leading-snug">“{pick(r.body, locale)}”</p>
                  <footer className="mt-6 border-t border-line pt-4 text-sm">
                    <span className="font-semibold">{r.author}</span>
                    <span className="block text-xs text-taupe">{pick(r.service_label, locale)}</span>
                  </footer>
                </blockquote>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* OFFERS -------------------------------------------------------------- */}
      {content.offers.length > 0 && (
        <section className="bg-cream py-20 sm:py-28">
          <div className="container-lux">
            <Reveal>
              <p className="eyebrow">{h.offersEyebrow}</p>
              <h2 className="heading-lg mt-4">{h.offersTitle}</h2>
            </Reveal>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {content.offers.map((o, i) => (
                <Reveal key={o.id} delay={i * 90}>
                  <article className="group relative flex h-full min-h-[22rem] flex-col justify-end overflow-hidden rounded-[var(--radius-card)] p-7 text-porcelain">
                    <SmartImage src={o.image_url ?? ""} alt={pick(o.title, locale)} fill sizes="(min-width: 1024px) 33vw, 100vw" wrapperClassName="absolute inset-0 -z-10" className="transition duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
                    {pick(o.badge, locale) && (
                      <span className="absolute top-6 left-6 rounded-full bg-porcelain px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-espresso">
                        {pick(o.badge, locale)}
                      </span>
                    )}
                    <h3 className="font-display text-3xl">{pick(o.title, locale)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-porcelain/80">{pick(o.description, locale)}</p>
                    {o.valid_until && <p className="mt-2 text-xs text-champagne">{fmt(h.validUntil, { date: formatDateKey(o.valid_until, locale, { weekday: undefined, year: "numeric" }) })}</p>}
                    <Link href={`/${locale}/booking`} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-champagne hover:text-porcelain">
                      {h.offerCta} <ArrowRight className="size-4" />
                    </Link>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* LOCATIONS ------------------------------------------------------------ */}
      <section id="contact" className="scroll-mt-20 py-20 sm:py-28">
        <div className="container-lux">
          <Reveal>
            <p className="eyebrow">{h.visitEyebrow}</p>
            <h2 className="heading-lg mt-4">{h.visitTitle}</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {branches.map((b, i) => (
              <Reveal key={b.id} delay={i * 90}>
                <article className="card grid h-full overflow-hidden sm:grid-cols-5">
                  <SmartImage src={b.image_url ?? ""} alt={`${salon.name} ${b.name}`} fill sizes="(min-width: 1024px) 20vw, 100vw" wrapperClassName="aspect-[16/10] sm:col-span-2 sm:aspect-auto sm:min-h-full" />
                  <div className="p-7 sm:col-span-3">
                    <h3 className="font-display text-3xl">{b.name}</h3>
                    <p className="mt-2 flex items-start gap-2 text-sm text-mocha">
                      <MapPin className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} /> {b.address}, {b.city}
                    </p>
                    <dl className="mt-5 space-y-1.5 text-sm">
                      {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                        const hr = b.hours.find((x) => x.weekday === d);
                        const isToday = d === todayWeekday;
                        return (
                          <div key={d} className={`flex justify-between gap-4 ${isToday ? "font-semibold text-espresso" : "text-mocha"}`}>
                            <dt>{t.hours.days[d]}{isToday && <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-gold-dark">{t.hours.today}</span>}</dt>
                            <dd className="tabular-nums">{!hr || hr.is_closed ? t.hours.closed : `${hr.open_time} – ${hr.close_time}`}</dd>
                          </div>
                        );
                      })}
                    </dl>
                    <div className="mt-6 flex flex-wrap gap-2">
                      <Link href={`/${locale}/booking?branch=${b.id}`} className="btn-primary px-5 py-2.5">{t.nav.book}</Link>
                      {b.map_url && <a href={b.map_url} target="_blank" rel="noopener noreferrer" className="btn-outline px-5 py-2.5">{h.directions}</a>}
                      {b.phone && (
                        <a href={`tel:${b.phone.replace(/\s/g, "")}`} className="btn-outline px-4 py-2.5" aria-label={`${h.call} ${b.name}`}>
                          <Phone className="size-4" strokeWidth={1.5} />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* INSTAGRAM ------------------------------------------------------------ */}
      {salon.instagram_url && (
        <section className="pb-20 sm:pb-28">
          <div className="container-lux">
            <Reveal className="flex flex-col items-center text-center">
              <p className="eyebrow">{h.instagramEyebrow}</p>
              <h2 className="heading-md mt-4">{fmt(h.instagramTitle, { handle: salon.instagram_handle ?? salon.name })}</h2>
            </Reveal>
            <div className="mt-10 grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
              {(igPosts ?? gallery.map((g) => ({ id: g.id, image: g.image_url, permalink: salon.instagram_url!, caption: pick(g.caption, locale) })))
                .slice(0, 6)
                .map((p) => (
                  <a key={p.id} href={p.permalink} target="_blank" rel="noopener noreferrer" className="group relative block aspect-square overflow-hidden rounded-xl">
                    <SmartImage src={p.image} alt={p.caption.slice(0, 100) || "Instagram"} fill sizes="(min-width: 1024px) 16vw, 33vw" wrapperClassName="absolute inset-0" className="transition duration-700 group-hover:scale-105" />
                    <span className="absolute inset-0 flex items-center justify-center bg-ink/0 text-porcelain opacity-0 transition group-hover:bg-ink/30 group-hover:opacity-100">
                      <InstagramIcon className="size-6" />
                    </span>
                  </a>
                ))}
            </div>
            <div className="mt-8 text-center">
              <a href={salon.instagram_url} target="_blank" rel="noopener noreferrer" className="btn-outline">
                <InstagramIcon className="size-4" /> {h.instagramCta}
              </a>
            </div>
          </div>
        </section>
      )}

      {/* CTA ------------------------------------------------------------------ */}
      <section className="relative isolate overflow-hidden bg-espresso py-24 text-center text-porcelain">
        <div className="absolute inset-0 -z-10 opacity-40 [background:radial-gradient(60%_80%_at_50%_0%,#b08d57_0%,transparent_70%)]" />
        <div className="container-lux">
          <h2 className="heading-lg mx-auto max-w-2xl text-balance">{h.ctaTitle}</h2>
          <p className="mx-auto mt-5 max-w-md text-porcelain/70">{h.ctaText}</p>
          <Link href={`/${locale}/booking`} className="btn-gold mt-9 px-9 py-4 text-[15px]">
            {t.nav.bookAppointment} <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
