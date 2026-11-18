import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { adminPage } from "@/lib/admin";
import { getBranches, getCategories, getEmployees, getServices } from "@/lib/catalog";
import { storageConfigured } from "@/lib/storage";
import { pick } from "@/i18n/config";
import { PageHeader, Panel, Flash, Field, LocalizedInput } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { SmartImage } from "@/components/ui/SmartImage";
import { saveServiceAction, deleteServiceAction } from "../actions";

export default async function ServiceEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { salon, locale, t, dict } = await adminPage(["owner", "manager"]);
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [categories, services, branches, employees] = await Promise.all([
    getCategories(salon.id), getServices(salon.id, false), getBranches(salon.id, false), getEmployees(salon.id, false),
  ]);
  const s = isNew ? null : services.find((x) => x.id === id);
  if (!isNew && !s) notFound();
  const ts = t.services;
  const errors: Record<string, string> = {
    in_use: ts.inUse, invalid: dict.booking.genericError, invalid_type: "JPG, PNG, WEBP, AVIF", too_large: "Max 5 MB",
    storage_not_configured: "Storage not configured",
  };
  const price = s ? (s.price_cents / 100).toFixed(s.price_cents % 100 ? 2 : 0) : "";

  return (
    <>
      <Link href="/admin/services" className="mb-4 inline-flex items-center gap-1 text-sm text-mocha hover:text-espresso"><ArrowLeft className="size-4" /> {ts.title}</Link>
      <Flash saved={sp.saved} error={sp.error ? errors[sp.error] ?? dict.booking.genericError : undefined} savedText={t.common.saved} />
      <PageHeader title={s ? pick(s.name, locale) : ts.new} />
      <form action={saveServiceAction} encType="multipart/form-data" className="grid gap-6 xl:grid-cols-3">
        {s && <input type="hidden" name="id" value={s.id} />}
        <Panel className="space-y-4 xl:col-span-2">
          <Field label={ts.category}>
            <select name="category_id" defaultValue={s?.category_id} className="input-sm">
              {categories.map((c) => <option key={c.id} value={c.id}>{pick(c.name, locale)}</option>)}
            </select>
          </Field>
          <LocalizedInput name="name" label={ts.nameField} value={s?.name} required />
          <LocalizedInput name="description" label={ts.description} value={s?.description} textarea />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label={`${ts.priceField} (${salon.currency})`}><input name="price" inputMode="decimal" required defaultValue={price} className="input-sm" /></Field>
            <Field label={ts.durationField}><input name="duration_minutes" type="number" min={5} max={600} step={5} required defaultValue={s?.duration_minutes ?? 60} className="input-sm" /></Field>
            <Field label={ts.buffer}><input name="buffer_minutes" type="number" min={0} max={120} step={5} defaultValue={s?.buffer_minutes ?? 0} className="input-sm" /></Field>
            <Field label="#"><input name="sort_order" type="number" min={0} defaultValue={s?.sort_order ?? 0} className="input-sm" /></Field>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="price_is_from" defaultChecked={s?.price_is_from ?? true} className="checkbox" /> {ts.priceFrom}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={s?.is_active ?? true} className="checkbox" /> {t.common.active}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_featured" defaultChecked={s?.is_featured ?? false} className="checkbox" /> {ts.featured}</label>
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel title={ts.image}>
            <SmartImage src={s?.image_url ?? ""} alt="" fill sizes="320px" wrapperClassName="mb-3 aspect-[16/10] rounded-xl" />
            <Field label={ts.imageUrl}><input name="image_url" type="url" defaultValue={s?.image_url ?? ""} className="input-sm" /></Field>
            {storageConfigured() && (
              <Field label={ts.uploadImage} className="mt-3"><input name="image_file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="text-sm" /></Field>
            )}
          </Panel>
          <Panel title={ts.branches}>
            {branches.map((b) => (
              <label key={b.id} className="flex items-center gap-2 py-1 text-sm">
                <input type="checkbox" name="branch_ids" value={b.id} defaultChecked={s ? s.branch_ids.includes(b.id) : true} className="checkbox" /> {b.name}
              </label>
            ))}
          </Panel>
          <Panel title={ts.staff}>
            {branches.map((b) => (
              <div key={b.id} className="mb-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-dark">{b.name}</p>
                {employees.filter((e) => e.branch_id === b.id).map((e) => (
                  <label key={e.id} className="flex items-center gap-2 py-1 text-sm">
                    <input type="checkbox" name="employee_ids" value={e.id} defaultChecked={s ? e.service_ids.includes(s.id) : false} className="checkbox" /> {e.first_name} {e.last_name}
                  </label>
                ))}
              </div>
            ))}
          </Panel>
          <SubmitButton className="btn-primary w-full py-3">{isNew ? t.common.create : t.common.save}</SubmitButton>
        </div>
      </form>
      {s && (
        <form action={deleteServiceAction} className="mt-8 text-right">
          <input type="hidden" name="id" value={s.id} />
          <SubmitButton className="btn border border-danger/30 px-4 py-2 text-danger hover:bg-danger/10" confirm={t.common.confirmDelete}><Trash2 className="size-4" /> {t.common.delete}</SubmitButton>
        </form>
      )}
    </>
  );
}
