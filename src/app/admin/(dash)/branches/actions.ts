"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminContext, f } from "@/lib/admin";
import { sql, isUniqueViolation } from "@/lib/db";
import { isDateKey } from "@/lib/time";

const ctx = () => adminContext(["owner", "manager"]);
async function own(salonId: string, id: string) {
  const [b] = await sql`select id from branches where id = ${id} and salon_id = ${salonId}`;
  if (!b) redirect("/admin/branches");
}

export async function saveBranchAction(fd: FormData) {
  const { salon, user } = await ctx();
  const id = f.opt(fd, "id");
  if (!id && user.role !== "owner") redirect("/admin/branches?error=forbidden");
  const name = f.str(fd, "name", 80);
  const slug = (f.str(fd, "slug", 60) || name).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const values = {
    name, slug,
    address: f.str(fd, "address", 200),
    city: f.str(fd, "city", 80),
    phone: f.opt(fd, "phone", 40),
    email: f.opt(fd, "email", 200),
    map_url: f.url(fd, "map_url"),
    image_url: f.url(fd, "image_url"),
    description: f.localized(fd, "description", 400),
    is_active: id ? f.bool(fd, "is_active") : true,
    sort_order: f.int(fd, "sort_order", 0, 999, 0),
  };
  if (!name || !slug || !values.address || !values.city) redirect(`/admin/branches/${id ?? ""}?error=invalid`);
  let branchId = id;
  try {
    if (id) {
      await own(salon.id, id);
      await sql`update branches set ${sql(values)} where id = ${id}`;
    } else {
      const [row] = await sql<{ id: string }[]>`insert into branches ${sql({ ...values, salon_id: salon.id })} returning id`;
      branchId = row.id;
      await sql`insert into branch_hours (branch_id, weekday, is_closed, open_time, close_time)
        select ${branchId}, d, d = 0, case when d = 0 then null else '09:00'::time end, case when d = 0 then null else '19:00'::time end
        from generate_series(0, 6) d`;
    }
  } catch (e) {
    if (isUniqueViolation(e)) redirect(`/admin/branches/${id ?? ""}?error=slug`);
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(`/admin/branches/${branchId}?saved=1`);
}

export async function saveBranchHoursAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.str(fd, "id");
  await own(salon.id, id);
  await sql.begin(async (tx) => {
    for (let d = 0; d < 7; d++) {
      const closed = !f.bool(fd, `open_${d}`);
      const o = f.time(fd, `from_${d}`), c = f.time(fd, `to_${d}`);
      if (!closed && (!o || !c || o >= c)) throw new Error("hours");
      await tx`insert into branch_hours (branch_id, weekday, is_closed, open_time, close_time)
        values (${id}, ${d}, ${closed}, ${closed ? null : o}, ${closed ? null : c})
        on conflict (branch_id, weekday) do update set is_closed = excluded.is_closed, open_time = excluded.open_time, close_time = excluded.close_time`;
    }
  }).catch((e) => {
    if ((e as Error).message === "hours") redirect(`/admin/branches/${id}?error=hours`);
    throw e;
  });
  revalidatePath("/", "layout");
  redirect(`/admin/branches/${id}?saved=1#hours`);
}

export async function saveBranchServicesAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.str(fd, "id");
  await own(salon.id, id);
  const ids = f.ids(fd, "service_ids");
  await sql.begin(async (tx) => {
    await tx`delete from branch_services where branch_id = ${id}`;
    await tx`insert into branch_services (branch_id, service_id) select ${id}, s.id from services s where s.salon_id = ${salon.id} and s.id = any(${ids}::uuid[])`;
  });
  revalidatePath("/", "layout");
  redirect(`/admin/branches/${id}?saved=1#services`);
}

export async function addClosureAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.str(fd, "id");
  await own(salon.id, id);
  const date = f.str(fd, "date");
  if (!isDateKey(date)) redirect(`/admin/branches/${id}?error=invalid`);
  await sql`insert into branch_closures (branch_id, date, reason) values (${id}, ${date}, ${f.opt(fd, "reason", 200)})
    on conflict (branch_id, date) do update set reason = excluded.reason`;
  redirect(`/admin/branches/${id}?saved=1#closures`);
}

export async function deleteClosureAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.str(fd, "id");
  await own(salon.id, id);
  await sql`delete from branch_closures where id = ${f.str(fd, "closure_id")} and branch_id = ${id}`;
  redirect(`/admin/branches/${id}?saved=1#closures`);
}
