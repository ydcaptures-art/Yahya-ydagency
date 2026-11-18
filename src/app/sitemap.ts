import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { siteUrl } from "@/lib/notifications";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const paths = ["", "/services", "/booking"];
  return paths.flatMap((p) =>
    locales.map((l) => ({
      url: `${base}/${l}${p}`,
      changeFrequency: "weekly" as const,
      priority: p === "" ? 1 : p === "/booking" ? 0.9 : 0.8,
      alternates: { languages: Object.fromEntries(locales.map((x) => [x, `${base}/${x}${p}`])) },
    })),
  );
}
