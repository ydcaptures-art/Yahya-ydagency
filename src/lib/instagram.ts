import "server-only";

export type InstagramPost = { id: string; image: string; permalink: string; caption: string };

/**
 * Latest posts via the official Instagram API (requires INSTAGRAM_ACCESS_TOKEN).
 * Returns null when not configured or on error, so the UI can fall back gracefully.
 */
export async function getInstagramPosts(limit = 6): Promise<InstagramPost[] | null> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const url = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&limit=${limit * 2}&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { id: string; caption?: string; media_type: string; media_url?: string; thumbnail_url?: string; permalink: string }[];
    };
    return (json.data ?? [])
      .map((m) => ({
        id: m.id,
        image: (m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url) ?? "",
        permalink: m.permalink,
        caption: m.caption ?? "",
      }))
      .filter((p) => p.image)
      .slice(0, limit);
  } catch {
    return null;
  }
}
