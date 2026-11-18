"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminContext, f } from "@/lib/admin";
import { sql } from "@/lib/db";
import { isDateKey } from "@/lib/time";

const ctx = () => adminContext(["owner", "manager"]);
const done = (hash: string) => {
  revalidatePath("/", "layout");
  redirect(`/admin/content?saved=1#${hash}`);
};

export async function saveOfferAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.opt(fd, "id");
  const until = f.str(fd, "valid_until");
  const v = {
    title: f.localized(fd, "title", 120), description: f.localized(fd, "description", 400), badge: f.localized(fd, "badge", 40),
    image_url: f.url(fd, "image_url"), valid_until: isDateKey(until) ? until : null, is_active: f.bool(fd, "is_active"),
    sort_order: f.int(fd, "sort_order", 0, 999, 0),
  };
  if (id) await sql`update offers set ${sql(v)} where id = ${id} and salon_id = ${salon.id}`;
  else await sql`insert into offers ${sql({ ...v, salon_id: salon.id })}`;
  done("offers");
}
export async function saveTestimonialAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.opt(fd, "id");
  const v = {
    author: f.str(fd, "author", 80), body: f.localized(fd, "body", 800), rating: f.int(fd, "rating", 1, 5, 5),
    service_label: f.localized(fd, "service_label", 80), is_active: f.bool(fd, "is_active"), sort_order: f.int(fd, "sort_order", 0, 999, 0),
  };
  if (id) await sql`update testimonials set ${sql(v)} where id = ${id} and salon_id = ${salon.id}`;
  else await sql`insert into testimonials ${sql({ ...v, salon_id: salon.id })}`;
  done("testimonials");
}
export async function saveGalleryAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.opt(fd, "id");
  const image = f.url(fd, "image_url");
  if (!image) redirect("/admin/content?error=invalid#gallery");
  const kind = f.str(fd, "kind") === "before_after" ? "before_after" : "gallery";
  const v = { kind, image_url: image, before_image_url: kind === "before_after" ? f.url(fd, "before_image_url") : null,
    caption: f.localized(fd, "caption", 120), sort_order: f.int(fd, "sort_order", 0, 999, 0) };
  if (id) await sql`update gallery_items set ${sql(v)} where id = ${id} and salon_id = ${salon.id}`;
  else await sql`insert into gallery_items ${sql({ ...v, salon_id: salon.id })}`;
  done("gallery");
}
export async function deleteContentAction(fd: FormData) {
  const { salon } = await ctx();
  const id = f.str(fd, "id");
  const table = f.str(fd, "table");
  if (table === "offers") await sql`delete from offers where id = ${id} and salon_id = ${salon.id}`;
  else if (table === "testimonials") await sql`delete from testimonials where id = ${id} and salon_id = ${salon.id}`;
  else if (table === "gallery") await sql`delete from gallery_items where id = ${id} and salon_id = ${salon.id}`;
  done(table);
}
