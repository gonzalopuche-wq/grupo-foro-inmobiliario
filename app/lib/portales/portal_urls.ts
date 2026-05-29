// Detecta a qué portal externo pertenece una URL y extrae su ID
export interface PortalRef {
  portal: string;
  portal_id: string;
  url: string;
}

const PORTAL_PATTERNS: Array<{ portal: string; re: RegExp; getId: (m: RegExpMatchArray) => string }> = [
  {
    portal: "zonaprop",
    re: /zonaprop\.com\.ar\/.*?(\d{7,})/,
    getId: m => m[1],
  },
  {
    portal: "argenprop",
    re: /argenprop\.com\/.*?-(\d{6,})\.html/,
    getId: m => m[1],
  },
  {
    portal: "mercadolibre",
    re: /mercadolibre\.com\.ar\/MLA-?(\d+)/,
    getId: m => `MLA${m[1]}`,
  },
  {
    portal: "properati",
    re: /properati\.com\.ar\/.*?\/(\w{8,})/,
    getId: m => m[1],
  },
];

export function detectarPortalDesdeUrl(url: string): PortalRef | null {
  if (!url) return null;
  for (const { portal, re, getId } of PORTAL_PATTERNS) {
    const m = url.match(re);
    if (m) return { portal, portal_id: getId(m), url };
  }
  return null;
}

// Extrae todas las URLs de publicación de un objeto raw de CRM (Kiteprop / Tokko)
export function extraerPublicaciones(raw: Record<string, any>): PortalRef[] {
  const refs: PortalRef[] = [];
  const seen = new Set<string>();

  // Kiteprop: portals[], publications[], links[]
  const listas = [
    raw.portals, raw.publications, raw.links,
    raw.portal_links, raw.external_urls,
  ];
  for (const lista of listas) {
    if (!Array.isArray(lista)) continue;
    for (const item of lista) {
      const url = item?.url ?? item?.link ?? (typeof item === "string" ? item : null);
      if (!url) continue;
      const ref = detectarPortalDesdeUrl(url);
      if (ref && !seen.has(ref.portal + ref.portal_id)) {
        seen.add(ref.portal + ref.portal_id);
        refs.push(ref);
      }
    }
  }

  // Tokko: fields like web_url, zonaprop_url, argenprop_url, etc.
  const urlFields = ["web_url", "zonaprop_url", "argenprop_url", "mercadolibre_url", "properati_url",
    "url", "link", "external_link"];
  for (const field of urlFields) {
    const url = raw[field];
    if (typeof url !== "string" || !url) continue;
    const ref = detectarPortalDesdeUrl(url);
    if (ref && !seen.has(ref.portal + ref.portal_id)) {
      seen.add(ref.portal + ref.portal_id);
      refs.push(ref);
    }
  }

  return refs;
}
