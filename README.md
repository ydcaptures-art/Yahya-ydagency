# YD Salon Platform

A premium beauty-salon website with a smart online booking system and an operational salon dashboard.
Built by **YD Agency**. It can be reused across salons: each salon is a tenant with its own branding, branches, services, team and bookings.

The demo tenant is **Maison Aurelle**, an Istanbul hair & beauty atelier with two branches. It is fictional; replace it with the real salon's details.

---

## What's inside

| Area | Highlights |
|---|---|
| **Website** (TR / EN / DE) | Hero, featured services, why-us, team, gallery, before/after slider, testimonials, offers, locations & live opening hours, Instagram, footer with "Website by YD Agency". Language switcher, sticky mobile *Book now* bar, WhatsApp button, JSON-LD (`BeautySalon`), sitemap, hreflang, robots. |
| **Services page** | Category tabs, image, description, "from" price, duration and a *Book now* button on every card. Everything is editable in the dashboard. |
| **Booking flow** | Branch → services (multi-select, running total of price & duration) → professional (or *any available*) → calendar with real slots → details → confirmation with reference, `.ics` download and a manage link. About a minute end to end. |
| **Self-service** | Customers can cancel or reschedule through a private link, within the salon's policy windows. |
| **Dashboard** | Overview (today, upcoming, bookings, revenue chart, popular services, cancellation rate), day/week/month calendar, appointment search & actions, manual bookings, customers & history, team (skills, hours, breaks, time off), services (prices, durations, buffers, images, branches, eligible staff), branches (hours, holidays, services), website content, notification log, settings & users. |
| **Roles** | **Owner**: everything. **Manager**: everything except settings & users. **Staff**: only their own calendar & appointments. Enforced on the server in every page and action. |
| **Notifications** | Booking confirmation, 24h reminder, cancellation and reschedule messages, by email (Resend) and WhatsApp (Meta WhatsApp Business Cloud API), in the customer's language. Each attempt is logged with its **real** status (sent / failed / skipped). Nothing is reported as sent unless the provider accepted it. |

## Double-booking protection

1. **Availability engine** (`src/lib/availability.ts`): a slot is offered only if an eligible professional performs *all* selected services, works at that branch that weekday, is inside branch hours, is not on a break or time off, and has no overlapping appointment. Minimum notice, booking horizon and holidays are respected. Unit-tested.
2. **Server re-validation**: every booking is re-checked on the server; client data is never trusted.
3. **Database constraint**: `appointments_no_overlap` is a PostgreSQL `EXCLUDE USING gist` constraint. It makes overlapping active appointments for the same professional impossible, even when two requests arrive in the same millisecond. Tested with 8 concurrent requests for one slot: exactly one succeeds. With *any professional*, the next free colleague is tried automatically.

## Tech stack

Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS v4 · PostgreSQL on **Supabase** · `postgres` driver (server-only) · Zod validation · bcrypt · date-fns-tz.

```
src/
  app/[locale]/        public site (tr, en, de): home, services, booking, booking/manage/[token]
  app/admin/           dashboard (login, overview, calendar, appointments, customers, staff, services, branches, content, notifications, settings, account)
  app/api/             availability, bookings, manage/[token], cron/reminders
  components/          site/, booking/, admin/, ui/
  i18n/                locale config + dictionaries (en.ts is the typed source; tr/de must match it)
  lib/                 db, catalog, availability, booking, notifications, auth, storage, validation, time, money
supabase/migrations/   schema, constraints, RLS
supabase/seed.sql      demo salon
scripts/               db.mts (migrate/seed), create-user.mts
tests/                 availability engine + database constraint tests
```

---

## Local development

Requirements: Node 20+, a PostgreSQL 15+ database (a Supabase project or local Postgres).

```bash
npm install
cp .env.example .env.local        # set DATABASE_URL at minimum
npm run db:migrate                # create schema
npm run db:seed                   # demo salon "Maison Aurelle" (re-running resets the demo tenant, including its dashboard users; recreate them afterwards)
npm run user:create -- --email you@salon.com --name "Your Name" --role owner
npm run dev                       # http://localhost:3000  ·  dashboard: /admin
```

`user:create` prints a temporary password once (or pass `--password`). Staff users need `--employee <employee-id>`. Owners can also create users from **Settings → Dashboard users**.

### Tests

```bash
npm test                                               # availability engine + phone normalisation
TEST_DATABASE_URL=postgresql://… npm test              # + database exclusion-constraint test (use a non-production DB)
npm run typecheck && npm run lint && npm run build
```

---

## Going live (Supabase + Vercel)

1. **Supabase**: create a project. In the SQL editor run `supabase/migrations/0001_init.sql` (and `supabase/seed.sql` if you want the demo), or run `npm run db:migrate` with the connection string.
   Use the **Transaction pooler** URI (port 6543) as `DATABASE_URL` on Vercel.
2. **Vercel**: import the repo and set the environment variables from `.env.example`. At minimum: `DATABASE_URL`, `SALON_SLUG`, `NEXT_PUBLIC_SITE_URL` and `CRON_SECRET` (a long random string).
3. **Reminders**: `vercel.json` schedules `/api/cron/reminders` once a day at 07:00 UTC (the free Hobby plan allows daily jobs only; on a paid plan change the schedule to `0 * * * *` for hourly). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically. The Hobby plan only runs crons once a day, so on Hobby either upgrade or call the endpoint hourly from another scheduler (Supabase `pg_cron` + `pg_net`, GitHub Actions, cron-job.org) with that header.
4. **Email**: create a [Resend](https://resend.com) account, verify the sending domain, then set `RESEND_API_KEY` and `EMAIL_FROM`.
5. **WhatsApp** (official Meta WhatsApp Business Cloud API): set `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`. Business-initiated messages require **approved templates**. Create four templates (`booking_confirmation`, `booking_reminder`, `booking_cancellation`, `booking_rescheduled`), each in `tr`, `en` and `de`, with six body variables in this order: `{{1}}` first name, `{{2}}` salon, `{{3}}` date, `{{4}}` time, `{{5}}` branch, `{{6}}` reference. Override the names with the `WHATSAPP_TEMPLATE_*` variables if you use different ones.
6. **Image uploads** (optional): create a public Storage bucket `salon-media`, then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (server-only). Without them, the dashboard accepts image URLs.
7. **Instagram** (optional): set `INSTAGRAM_ACCESS_TOKEN` (Instagram API long-lived token) to show the latest real posts. Without it, the section shows the salon gallery linking to the profile.

The dashboard's **Notifications** page shows which providers are connected and the delivery status of every message.

## Reusing for another salon

Every table is scoped by `salon_id`. For a new client:

1. Insert a `salons` row (or copy `seed.sql` and adapt it): name, tagline, colours via content, currency, time zone, default phone country code, policies.
2. Deploy the same repository as a new Vercel project with `SALON_SLUG=<new-slug>` and the client's domain.
3. Create the owner with `npm run user:create` (with that `SALON_SLUG`).

Branding, services, branches, staff, content and bookings stay fully separate per salon.

## Security notes

- All database access happens on the server. No database credentials or API keys reach the browser (only `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_AGENCY_URL` are public).
- Row Level Security is enabled on every table, with no policies for Supabase's `anon`/`authenticated` roles, so the public Supabase REST API exposes nothing even if the anon key is known.
- Dashboard auth: bcrypt-hashed passwords, random session tokens stored only as SHA-256 hashes, `HttpOnly` + `SameSite=Lax` (+ `Secure` in production) cookies, 14-day expiry, lock-out after 5 failed attempts in 15 minutes. Server Actions get Next.js's built-in origin check against CSRF.
- Customer manage links use 192-bit random tokens; manage pages are `noindex`.
- Booking endpoints validate every field with Zod, use a honeypot field and rate limiting, and normalise phone numbers to E.164.
- Security headers: HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.

### Note on authentication

Dashboard users live in the salon's Supabase Postgres database (`users`, `sessions` tables) and use the app's own session layer, not the Supabase Auth service. This keeps auth, roles and tenant scoping in one place and lets everything be tested end to end. If you prefer Supabase Auth (magic links, SSO), only `src/lib/auth.ts` and the login page need to change; every page and action already goes through `requireUser()`.

## Before launch checklist

- Replace the demo photography (currently Unsplash URLs) with the salon's own images.
- Replace the demo trust indicators (rating, client count, years) and the testimonials with real ones (Settings / Website content).
- Review the booking and cancellation policy texts in all three languages.
- Set the real WhatsApp number, social links and branch addresses.
