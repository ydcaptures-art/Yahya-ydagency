"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminContext, f } from "@/lib/admin";
import { sql } from "@/lib/db";
import { uploadImage } from "@/lib/storage";

const ctx = () => adminContext(["owner", "manager"]);

export async function saveServiceAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.opt(fd, "id");
  const back = `/admin/services/${id ?? "new"}`;
  const categoryId = f.str(fd, "category_id");
  const [cat] = await sql`select id from service_categories where id = ${categoryId} and salon_id = ${salon.id}`;
  const name = f.localized(fd, "name", 120);
  if (!cat || !name.tr && !name.en && !name.de) redirect(`${back}?error=invalid`);

  let image = f.url(fd, "image_url");
  try {
    image = (await uploadImage(fd.get("image_file"), `services`)) ?? image;
  } catch (e) {
    redirect(`${back}?error=${(e as Error).message}`);
  }

  const values = {
    category_id: categoryId,
    name,
    description: f.localized(fd, "description", 600),
    price_cents: f.money(fd, "price"),
    price_is_from: f.bool(fd, "price_is_from"),
    duration_minutes: f.int(fd, "duration_minutes", 5, 600, 60),
    buffer_minutes: f.int(fd, "buffer_minutes", 0, 120, 0),
    image_url: image,
    is_active: f.bool(fd, "is_active"),
    is_featured: f.bool(fd, "is_featured"),
    sort_order: f.int(fd, "sort_order", 0, 999, 0),
  };
  const branchIds = f.ids(fd, "branch_ids");
  const employeeIds = f.ids(fd, "employee_ids");

  const serviceId = await sql.begin(async (tx) => {
    let sid = id;
    if (id) {
      const rows = await tx`update services set ${tx(values)} where id = ${id} and salon_id = ${salon.id} returning id`;
      if (!rows.length) throw new Error("not_found");
    } else {
      const [row] = await tx<{ id: string }[]>`insert into services ${tx({ ...values, salon_id: salon.id })} returning id`;
      sid = row.id;
    }
    await tx`delete from branch_services where service_id = ${sid!}`;
    await tx`insert into branch_services (branch_id, service_id)
      select b.id, ${sid!} from branches b where b.salon_id = ${salon.id} and b.id = any(${branchIds}::uuid[])`;
    await tx`delete from employee_services where service_id = ${sid!}`;
    await tx`insert into employee_services (employee_id, service_id)
      select e.id, ${sid!} from employees e where e.salon_id = ${salon.id} and e.id = any(${employeeIds}::uuid[])`;
    return sid!;
  });
  revalidatePath("/", "layout");
  redirect(`/admin/services/${serviceId}?saved=1`);
}

export async function deleteServiceAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.str(fd, "id");
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from appointment_services where service_id = ${id}`;
  if (n > 0) {
    await sql`update services set is_active = false where id = ${id} and salon_id = ${salon.id}`;
    revalidatePath("/", "layout");
    redirect(`/admin/services/${id}?error=in_use`);
  }
  await sql`delete from services where id = ${id} and salon_id = ${salon.id}`;
  revalidatePath("/", "layout");
  redirect("/admin/services?saved=1");
}

export async function saveCategoryAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.opt(fd, "id");
  const name = f.localized(fd, "name", 120);
  const sort = f.int(fd, "sort_order", 0, 999, 0);
  if (!name.tr && !name.en) redirect("/admin/services?error=invalid");
  if (id) {
    await sql`update service_categories set name = ${sql.json(name)}, sort_order = ${sort} where id = ${id} and salon_id = ${salon.id}`;
  } else {
    const base = (name.en || name.tr || "category").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "category";
    await sql`insert into service_categories (salon_id, slug, name, sort_order)
      values (${salon.id}, ${base + "-" + Date.now().toString(36)}, ${sql.json(name)}, ${sort})`;
  }
  revalidatePath("/", "layout");
  redirect("/admin/services?saved=1#categories");
}

export async function deleteCategoryAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.str(fd, "id");
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from services where category_id = ${id}`;
  if (n > 0) redirect("/admin/services?error=category_in_use#categories");
  await sql`delete from service_categories where id = ${id} and salon_id = ${salon.id}`;
  redirect("/admin/services?saved=1#categories");
}
