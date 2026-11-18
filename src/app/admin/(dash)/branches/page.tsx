import Link from "next/link";
import { MapPin } from "lucide-react";
import { adminPage } from "@/lib/admin";
import { getBranches, getEmployees, getServices } from "@/lib/catalog";
import { fmt } from "@/i18n/dictionaries";
import { PageHeader, Panel, Flash, Field, Badge } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { SmartImage } from "@/components/ui/SmartImage";
import { saveBranchAction } from "./actions";

export default async function BranchesPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const { user, salon, t } = await adminPage(["owner", "manager"]);
  const [branches, employees, services] = await Promise.all([getBranches(salon.id, false), getEmployees(salon.id), getServices(salon.id)]);
  const tb = t.branches;
  return (
    <>
      <PageHeader title={tb.title} />
      <Flash saved={sp.saved} error={sp.error === "forbidden" ? t.common.forbidden : undefined} savedText={t.common.saved} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="grid gap-6 md:grid-cols-2 xl:col-span-2">
          {branches.map((b) => (
            <Link key={b.id} href={`/admin/branches/${b.id}`} className="overflow-hidden rounded-2xl border border-line bg-porcelain shadow-soft transition hover:shadow-lift">
              <SmartImage src={b.image_url ?? ""} alt="" fill sizes="400px" wrapperClassName="aspect-[16/8]" />
              <div className="p-5">
                <div className="flex items-center justify-between"><p className="font-display text-2xl">{b.name}</p>{!b.is_active && <Badge status="cancelled" label={t.common.inactive} />}</div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-mocha"><MapPin className="size-3.5" /> {b.address}, {b.city}</p>
                <p className="mt-3 text-xs text-taupe">
                  {fmt(tb.staffCount, { count: employees.filter((e) => e.branch_id === b.id).length })} · {fmt(tb.serviceCount, { count: services.filter((s) => s.branch_ids.includes(b.id)).length })}
                </p>
              </div>
            </Link>
          ))}
        </div>
        {user.role === "owner" && (
          <Panel title={tb.new} className="h-fit">
            <form action={saveBranchAction} className="space-y-3">
              <Field label={t.common.name}><input name="name" required className="input-sm" /></Field>
              <Field label={tb.address}><input name="address" required className="input-sm" /></Field>
              <Field label={tb.city}><input name="city" required className="input-sm" /></Field>
              <Field label={t.common.phone}><input name="phone" className="input-sm" /></Field>
              <SubmitButton>{t.common.create}</SubmitButton>
            </form>
          </Panel>
        )}
      </div>
    </>
  );
}
