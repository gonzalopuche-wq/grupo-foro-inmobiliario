import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: webs } = await supabase
    .from("web_corredor_config")
    .select("slug, updated_at")
    .eq("activa", true);

  const webRoutes: MetadataRoute.Sitemap = (webs ?? []).flatMap(w => [
    {
      url: `https://foroinmobiliario.com.ar/web/${w.slug}`,
      lastModified: new Date(w.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    {
      url: `https://foroinmobiliario.com.ar/web/${w.slug}/propiedades`,
      lastModified: new Date(w.updated_at),
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `https://foroinmobiliario.com.ar/web/${w.slug}/blog`,
      lastModified: new Date(w.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    },
  ]);

  return [
    {
      url: "https://foroinmobiliario.com.ar",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    ...webRoutes,
  ];
}
