"use server";
import { redirect } from "next/navigation";
import { adminContext, f } from "@/lib/admin";
import { sql } from "@/lib/db";
import { normalizePhone } from "@/lib/validation";
import { isUniqueViolation } from "@/lib/db";

export async function updateCustomerAction(fd: FormData) {
  const { salon } = await adminContext(["owner", "manager"]);
  const id = f.str(fd, "id");
  const phone = normalizePhone(f.str(fd, "phone", 30), salon.phone_country_code);
  if (!phone) redirect(`/admin/customers/${id}?error=phone`);
  try {
    await sql`update customers set first_name = ${f.str(fd, "first_name", 80)}, last_name = ${f.str(fd, "last_name", 80)},
      phone = ${phone}, email = ${f.opt(fd, "email", 200)?.toLowerCase() ?? null}, notes = ${f.opt(fd, "notes", 4000)},
      marketing_opt_in = ${f.bool(fd, "marketing_opt_in")}
      where id = ${id} and salon_id = ${salon.id}`;
  } catch (e) {
    if (isUniqueViolation(e)) redirect(`/admin/customers/${id}?error=phone`);
    throw e;
  }
  redirect(`/admin/customers/${id}?saved=1`);
}
