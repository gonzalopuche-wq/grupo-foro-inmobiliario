import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/web/", "/b/", "/inmueble/", "/propiedades"],
        disallow: ["/dashboard", "/crm", "/cartera", "/comparables", "/mi-web", "/admin", "/api/"],
      },
    ],
    sitemap: "https://www.foroinmobiliario.com.ar/sitemap.xml",
  };
}
