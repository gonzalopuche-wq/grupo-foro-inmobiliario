import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const BASE = "https://www.foroinmobiliario.com.ar";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: webs }, { data: props }] = await Promise.all([
    supabase.from("web_corredor_config").select("slug, updated_at").eq("activa", true),
    supabase.from("cartera_propiedades").select("id, updated_at")
      .in("estado", ["activa", "reservada"])
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const webRoutes: MetadataRoute.Sitemap = (webs ?? []).flatMap(w => [
    {
      url: `${BASE}/web/${w.slug}`,
      lastModified: new Date(w.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
    {
      url: `${BASE}/web/${w.slug}/propiedades`,
      lastModified: new Date(w.updated_at),
      changeFrequency: "daily" as const,
      priority: 0.8,
    },
    {
      url: `${BASE}/web/${w.slug}/blog`,
      lastModified: new Date(w.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    },
  ]);

  const propRoutes: MetadataRoute.Sitemap = (props ?? []).map(p => ({
    url: `${BASE}/inmueble/${p.id}`,
    lastModified: new Date(p.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: "daily" as const, priority: 1 },
    { url: `${BASE}/propiedades`, lastModified: new Date(), changeFrequency: "hourly" as const, priority: 0.9 },
    ...propRoutes,
    ...webRoutes,
  ];
}
