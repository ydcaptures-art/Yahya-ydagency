import "server-only";
import { randomBytes } from "crypto";

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);
const MAX_BYTES = 5 * 1024 * 1024;

export function storageConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Uploads an image to Supabase Storage (public bucket, default "salon-media")
 * using the server-only service-role key. Returns the public URL, or null if
 * no file was provided. Throws on invalid files.
 */
export async function uploadImage(file: FormDataEntryValue | null, folder: string): Promise<string | null> {
  if (!file || typeof file === "string" || file.size === 0) return null;
  if (!storageConfigured()) throw new Error("storage_not_configured");
  const ext = ALLOWED.get(file.type);
  if (!ext) throw new Error("invalid_type");
  if (file.size > MAX_BYTES) throw new Error("too_large");
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "salon-media";
  const path = `${folder}/${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  const base = process.env.SUPABASE_URL!.replace(/\/$/, "");
  const res = await fetch(`${base}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": file.type,
      "Cache-Control": "31536000",
    },
    body: Buffer.from(await file.arrayBuffer()),
  });
  if (!res.ok) throw new Error(`upload_failed_${res.status}`);
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
