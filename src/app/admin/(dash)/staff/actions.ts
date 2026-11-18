"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminContext, f } from "@/lib/admin";
import { sql } from "@/lib/db";
import { zonedToUtc, isDateKey } from "@/lib/time";

const ctx = () => adminContext(["owner", "manager"]);

async function assertEmployee(salonId: string, id: string) {
  const [e] = await sql`select id from employees where id = ${id} and salon_id = ${salonId}`;
  if (!e) redirect("/admin/staff");
}
async function assertBranch(salonId: string, id: string) {
  const [b] = await sql`select id from branches where id = ${id} and salon_id = ${salonId}`;
  if (!b) redirect("/admin/staff?error=branch");
}

export async function saveEmployeeAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.opt(fd, "id");
  const branchId = f.str(fd, "branch_id");
  await assertBranch(salon.id, branchId);
  const values = {
    branch_id: branchId,
    first_name: f.str(fd, "first_name", 80),
    last_name: f.str(fd, "last_name", 80),
    title: f.localized(fd, "title", 120),
    bio: f.localized(fd, "bio", 600),
    photo_url: f.url(fd, "photo_url"),
    email: f.opt(fd, "email", 200),
    phone: f.opt(fd, "phone", 40),
    is_active: id ? f.bool(fd, "is_active") : true,
    is_bookable: f.bool(fd, "is_bookable"),
  };
  if (!values.first_name || !values.last_name) redirect(`/admin/staff${id ? "/" + id : ""}?error=invalid`);
  let empId = id;
  if (id) {
    await assertEmployee(salon.id, id);
    await sql`update employees set ${sql(values)} where id = ${id}`;
  } else {
    const [row] = await sql<{ id: string }[]>`insert into employees ${sql({ ...values, salon_id: salon.id })} returning id`;
    empId = row.id;
    // sensible default: Mon–Sat 10:00–19:00 with a lunch break
    await sql`insert into employee_working_hours (employee_id, weekday, start_time, end_time, break_start, break_end)
      select ${empId}, d, '10:00', '19:00', '13:00', '13:45' from generate_series(1, 6) d`;
  }
  revalidatePath("/", "layout");
  redirect(`/admin/staff/${empId}?saved=1`);
}

export async function saveSkillsAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.str(fd, "id");
  await assertEmployee(salon.id, id);
  const ids = f.ids(fd, "service_ids");
  await sql.begin(async (tx) => {
    await tx`delete from employee_services where employee_id = ${id}`;
    if (ids.length) {
      await tx`insert into employee_services (employee_id, service_id)
        select ${id}, s.id from services s where s.salon_id = ${salon.id} and s.id = any(${ids}::uuid[])`;
    }
  });
  revalidatePath("/", "layout");
  redirect(`/admin/staff/${id}?saved=1#skills`);
}

export async function saveHoursAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.str(fd, "id");
  await assertEmployee(salon.id, id);
  const rows: { weekday: number; start: string; end: string; bs: string | null; be: string | null }[] = [];
  for (let d = 0; d < 7; d++) {
    if (!f.bool(fd, `on_${d}`)) continue;
    const start = f.time(fd, `start_${d}`), end = f.time(fd, `end_${d}`);
    const bs = f.time(fd, `bstart_${d}`), be = f.time(fd, `bend_${d}`);
    if (!start || !end || start >= end) redirect(`/admin/staff/${id}?error=hours#hours`);
    const hasBreak = bs && be && bs < be && bs >= start && be <= end;
    rows.push({ weekday: d, start, end, bs: hasBreak ? bs : null, be: hasBreak ? be : null });
  }
  await sql.begin(async (tx) => {
    await tx`delete from employee_working_hours where employee_id = ${id}`;
    for (const r of rows) {
      await tx`insert into employee_working_hours (employee_id, weekday, start_time, end_time, break_start, break_end)
        values (${id}, ${r.weekday}, ${r.start}, ${r.end}, ${r.bs}, ${r.be})`;
    }
  });
  redirect(`/admin/staff/${id}?saved=1#hours`);
}

export async function addTimeOffAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.str(fd, "id");
  await assertEmployee(salon.id, id);
  const fromDate = f.str(fd, "from_date"), toDate = f.str(fd, "to_date") || fromDate;
  const fromTime = f.time(fd, "from_time") ?? "00:00";
  const toTime = f.time(fd, "to_time") ?? "23:59";
  if (!isDateKey(fromDate) || !isDateKey(toDate)) redirect(`/admin/staff/${id}?error=invalid#timeoff`);
  const startsAt = zonedToUtc(fromDate, fromTime, salon.timezone);
  const endsAt = zonedToUtc(toDate, toTime, salon.timezone);
  if (endsAt <= startsAt) redirect(`/admin/staff/${id}?error=invalid#timeoff`);
  await sql`insert into employee_time_off (employee_id, starts_at, ends_at, reason) values (${id}, ${startsAt}, ${endsAt}, ${f.opt(fd, "reason", 200)})`;
  redirect(`/admin/staff/${id}?saved=1#timeoff`);
}

export async function deleteTimeOffAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.str(fd, "id");
  await sql`delete from employee_time_off t using employees e where t.id = ${f.str(fd, "timeoff_id")} and e.id = t.employee_id and e.salon_id = ${salon.id}`;
  redirect(`/admin/staff/${id}?saved=1#timeoff`);
}

export async function deleteEmployeeAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.str(fd, "id");
  await assertEmployee(salon.id, id);
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from appointments where employee_id = ${id}`;
  if (n > 0) {
    // Keep history intact: deactivate instead of deleting
    await sql`update employees set is_active = false, is_bookable = false where id = ${id}`;
    revalidatePath("/", "layout");
    redirect(`/admin/staff/${id}?error=has_appointments`);
  }
  await sql`delete from employees where id = ${id}`;
  revalidatePath("/", "layout");
  redirect("/admin/staff?saved=1");
}
