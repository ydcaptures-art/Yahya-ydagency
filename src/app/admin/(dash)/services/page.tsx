import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { adminPage } from "@/lib/admin";
import { getCategories, getServices } from "@/lib/catalog";
import { pick } from "@/i18n/config";
import { formatMoney } from "@/lib/money";
import { PageHeader, Panel, Flash, Badge, LocalizedInput } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { SmartImage } from "@/components/ui/SmartImage";
import { saveCategoryAction, deleteCategoryAction } from "./actions";

export default async function ServicesAdminPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const { salon, locale, t, dict } = await adminPage(["owner", "manager"]);
  const [categories, services] = await Promise.all([getCategories(salon.id), getServices(salon.id, false)]);
  const ts = t.services;
  return (
    <>
      <PageHeader title={ts.title} actions={<Link href="/admin/services/new" className="btn-primary px-5 py-2.5"><Plus className="size-4" /> {ts.new}</Link>} />
      <Flash saved={sp.saved} error={sp.error ? (sp.error === "category_in_use" ? ts.inUse : dict.booking.genericError) : undefined} savedText={t.common.saved} />
      <div className="space-y-6">
        {categories.map((c) => {
          const items = services.filter((s) => s.category_id === c.id);
          return (
            <Panel key={c.id} title={pick(c.name, locale)}>
              {items.length === 0 ? <p className="text-sm text-taupe">—</p> : (
                <ul className="divide-y divide-line">
                  {items.map((s) => (
                    <li key={s.id}>
                      <Link href={`/admin/services/${s.id}`} className="flex items-center gap-4 py-3 hover:bg-ivory">
                        <SmartImage src={s.image_url ?? ""} alt="" fill sizes="56px" wrapperClassName="size-14 shrink-0 rounded-xl" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{pick(s.name, locale)}</span>
                          <span className="block text-xs text-taupe">{s.duration_minutes} {t.common.minutes}{s.buffer_minutes ? ` + ${s.buffer_minutes}` : ""} · {s.branch_ids.length} {t.nav.branches.toLowerCase()}</span>
                        </span>
                        {s.is_featured && <Badge status="confirmed" label="★" />}
                        {!s.is_active && <Badge status="cancelled" label={t.common.inactive} />}
                        <span className="w-28 text-right font-semibold tabular-nums">{s.price_is_from ? <span className="mr-1 text-xs font-normal text-taupe">{dict.services.from}</span> : null}{formatMoney(s.price_cents, salon.currency, locale)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          );
        })}

        <Panel title={ts.categories}>
          <div id="categories" className="scroll-mt-20 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((c) => (
              <div key={c.id} className="rounded-xl border border-line p-4">
                <form action={saveCategoryAction} className="space-y-2">
                  <input type="hidden" name="id" value={c.id} />
                  <LocalizedInput name="name" label={ts.nameField} value={c.name} required />
                  <div className="flex items-center gap-2">
                    <input name="sort_order" type="number" defaultValue={c.sort_order} className="input-sm w-20" aria-label="Sort" />
                    <SubmitButton className="btn-outline px-4 py-1.5">{t.common.save}</SubmitButton>
                  </div>
                </form>
                <form action={deleteCategoryAction} className="mt-2 text-right">
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton className="text-xs text-taupe hover:text-danger" confirm={t.common.confirmDelete}><Trash2 className="inline size-3.5" /> {t.common.delete}</SubmitButton>
                </form>
              </div>
            ))}
            <form action={saveCategoryAction} className="space-y-2 rounded-xl border border-dashed border-gold p-4">
              <p className="text-xs font-semibold text-gold-dark">{ts.newCategory}</p>
              <LocalizedInput name="name" label={ts.nameField} required />
              <input type="hidden" name="sort_order" value={categories.length + 1} />
              <SubmitButton className="btn-primary px-4 py-1.5">{t.common.add}</SubmitButton>
            </form>
          </div>
        </Panel>
      </div>
    </>
  );
}
