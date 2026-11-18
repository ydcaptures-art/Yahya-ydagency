import { Trash2 } from "lucide-react";
import { adminPage } from "@/lib/admin";
import { sql } from "@/lib/db";
import type { Localized } from "@/i18n/config";
import { pick } from "@/i18n/config";
import { PageHeader, Panel, Flash, Field, LocalizedInput } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { SmartImage } from "@/components/ui/SmartImage";
import { saveOfferAction, saveTestimonialAction, saveGalleryAction, deleteContentAction } from "./actions";

type Offer = { id: string; title: Localized; description: Localized; badge: Localized; image_url: string | null; valid_until: string | null; is_active: boolean; sort_order: number };
type Review = { id: string; author: string; body: Localized; rating: number; service_label: Localized; is_active: boolean; sort_order: number };
type Item = { id: string; kind: string; image_url: string; before_image_url: string | null; caption: Localized; sort_order: number };

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const { salon, locale, t, dict } = await adminPage(["owner", "manager"]);
  const [offers, reviews, gallery] = await Promise.all([
    sql<Offer[]>`select id, title, description, badge, image_url, to_char(valid_until,'YYYY-MM-DD') as valid_until, is_active, sort_order from offers where salon_id = ${salon.id} order by sort_order`,
    sql<Review[]>`select id, author, body, rating, service_label, is_active, sort_order from testimonials where salon_id = ${salon.id} order by sort_order`,
    sql<Item[]>`select id, kind, image_url, before_image_url, caption, sort_order from gallery_items where salon_id = ${salon.id} order by kind, sort_order`,
  ]);
  const tc = t.content;
  const Del = ({ id, table }: { id: string; table: string }) => (
    <form action={deleteContentAction}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="table" value={table} />
      <SubmitButton className="inline-flex items-center gap-1 text-xs text-taupe hover:text-danger" confirm={t.common.confirmDelete}><Trash2 className="size-3.5" /> {t.common.delete}</SubmitButton>
    </form>
  );
  const OfferForm = ({ o }: { o?: Offer }) => (
    <form action={saveOfferAction} className="space-y-3">
      {o && <input type="hidden" name="id" value={o.id} />}
      <LocalizedInput name="title" label={tc.titleField} value={o?.title} required />
      <LocalizedInput name="description" label={t.services.description} value={o?.description} textarea />
      <LocalizedInput name="badge" label={tc.badge} value={o?.badge} />
      <Field label={t.services.imageUrl}><input name="image_url" type="url" defaultValue={o?.image_url ?? ""} className="input-sm" /></Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label={tc.validUntil}><input name="valid_until" type="date" defaultValue={o?.valid_until ?? ""} className="input-sm" /></Field>
        <Field label="#"><input name="sort_order" type="number" defaultValue={o?.sort_order ?? 0} className="input-sm" /></Field>
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={o?.is_active ?? true} className="checkbox" /> {t.common.active}</label>
      </div>
      <SubmitButton className="btn-primary px-4 py-2">{o ? t.common.save : t.common.add}</SubmitButton>
    </form>
  );
  const ReviewForm = ({ r }: { r?: Review }) => (
    <form action={saveTestimonialAction} className="space-y-3">
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="grid grid-cols-3 gap-2">
        <Field label={tc.author} className="col-span-2"><input name="author" defaultValue={r?.author} required className="input-sm" /></Field>
        <Field label={tc.rating}><input name="rating" type="number" min={1} max={5} defaultValue={r?.rating ?? 5} className="input-sm" /></Field>
      </div>
      <LocalizedInput name="body" label={tc.body} value={r?.body} textarea required />
      <LocalizedInput name="service_label" label={t.common.service} value={r?.service_label} />
      <div className="flex items-center gap-4">
        <input name="sort_order" type="number" defaultValue={r?.sort_order ?? 0} className="input-sm w-20" aria-label="#" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={r?.is_active ?? true} className="checkbox" /> {t.common.active}</label>
      </div>
      <SubmitButton className="btn-primary px-4 py-2">{r ? t.common.save : t.common.add}</SubmitButton>
    </form>
  );
  const GalleryForm = ({ g }: { g?: Item }) => (
    <form action={saveGalleryAction} className="space-y-3">
      {g && <input type="hidden" name="id" value={g.id} />}
      <div className="grid grid-cols-3 gap-2">
        <Field label={tc.kind} className="col-span-2">
          <select name="kind" defaultValue={g?.kind ?? "gallery"} className="input-sm">
            <option value="gallery">{tc.gallery}</option><option value="before_after">{dict.home.beforeAfterTitle}</option>
          </select>
        </Field>
        <Field label="#"><input name="sort_order" type="number" defaultValue={g?.sort_order ?? 0} className="input-sm" /></Field>
      </div>
      <Field label={`${t.services.imageUrl} (${dict.home.after})`}><input name="image_url" type="url" required defaultValue={g?.image_url} className="input-sm" /></Field>
      <Field label={tc.beforeImage}><input name="before_image_url" type="url" defaultValue={g?.before_image_url ?? ""} className="input-sm" /></Field>
      <LocalizedInput name="caption" label={tc.caption} value={g?.caption} />
      <SubmitButton className="btn-primary px-4 py-2">{g ? t.common.save : t.common.add}</SubmitButton>
    </form>
  );

  return (
    <>
      <PageHeader title={tc.title} />
      <Flash saved={sp.saved} error={sp.error ? dict.booking.genericError : undefined} savedText={t.common.saved} />
      <div className="space-y-8">
        <Panel title={tc.offers}>
          <div id="offers" className="grid scroll-mt-20 gap-4 lg:grid-cols-2">
            {offers.map((o) => (
              <details key={o.id} className="rounded-xl border border-line p-4">
                <summary className="flex cursor-pointer items-center justify-between font-medium">{pick(o.title, locale)} {!o.is_active && <span className="text-xs text-taupe">({t.common.inactive})</span>}</summary>
                <div className="mt-4"><OfferForm o={o} /><div className="mt-3 text-right"><Del id={o.id} table="offers" /></div></div>
              </details>
            ))}
            <details className="rounded-xl border border-dashed border-gold p-4"><summary className="cursor-pointer text-sm font-semibold text-gold-dark">+ {t.common.add}</summary><div className="mt-4"><OfferForm /></div></details>
          </div>
        </Panel>
        <Panel title={tc.testimonials}>
          <div id="testimonials" className="grid scroll-mt-20 gap-4 lg:grid-cols-2">
            {reviews.map((r) => (
              <details key={r.id} className="rounded-xl border border-line p-4">
                <summary className="cursor-pointer font-medium">{r.author} · {"★".repeat(r.rating)}</summary>
                <div className="mt-4"><ReviewForm r={r} /><div className="mt-3 text-right"><Del id={r.id} table="testimonials" /></div></div>
              </details>
            ))}
            <details className="rounded-xl border border-dashed border-gold p-4"><summary className="cursor-pointer text-sm font-semibold text-gold-dark">+ {t.common.add}</summary><div className="mt-4"><ReviewForm /></div></details>
          </div>
        </Panel>
        <Panel title={tc.gallery}>
          <div id="gallery" className="grid scroll-mt-20 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {gallery.map((g) => (
              <details key={g.id} className="rounded-xl border border-line p-3">
                <summary className="cursor-pointer list-none">
                  <SmartImage src={g.image_url} alt="" fill sizes="300px" wrapperClassName="aspect-[4/3] rounded-lg" />
                  <span className="mt-2 block text-sm">{pick(g.caption, locale)} {g.kind === "before_after" && <span className="text-xs text-gold-dark">· {dict.home.beforeAfterTitle}</span>}</span>
                </summary>
                <div className="mt-4"><GalleryForm g={g} /><div className="mt-3 text-right"><Del id={g.id} table="gallery" /></div></div>
              </details>
            ))}
            <details className="rounded-xl border border-dashed border-gold p-4"><summary className="cursor-pointer text-sm font-semibold text-gold-dark">+ {t.common.add}</summary><div className="mt-4"><GalleryForm /></div></details>
          </div>
        </Panel>
      </div>
    </>
  );
}
