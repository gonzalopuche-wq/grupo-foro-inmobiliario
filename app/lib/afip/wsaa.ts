// ─────────────────────────────────────────────────────────────────────────────
// WSAA — Autenticación con AFIP (obtiene Token + Sign para usar WSFE).
// SOLO SERVIDOR. Firma el LoginTicketRequest como CMS/PKCS#7 con el certificado
// del contribuyente y cachea el token (válido ~12h) en la tabla afip_tokens.
//
// Requiere en variables de entorno (Vercel):
//   - AFIP_CERT[_<suf>]  → certificado en PEM (-----BEGIN CERTIFICATE-----...)
//   - AFIP_KEY[_<suf>]   → clave privada en PEM (-----BEGIN PRIVATE KEY-----...)
//   Para múltiples emisores (socios), usar sufijos y guardarlos en facturacion_emisores.cert_env.
// ─────────────────────────────────────────────────────────────────────────────
import "server-only";
import forge from "node-forge";
import { XMLParser } from "fast-xml-parser";
import { createClient } from "@supabase/supabase-js";

export type Ambiente = "homologacion" | "produccion";

const WSAA_URL: Record<Ambiente, string> = {
  homologacion: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
  produccion: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
};

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export interface TicketAcceso {
  token: string;
  sign: string;
  expira: Date;
}

// Lee el certificado y la clave de las variables de entorno (con sufijo opcional
// para emisores adicionales: AFIP_CERT_SOCIO1 / AFIP_KEY_SOCIO1).
export function credencialesDesdeEnv(certEnv?: string | null): { cert: string; key: string } | null {
  const suf = certEnv ? `_${certEnv}` : "";
  const cert = process.env[`AFIP_CERT${suf}`];
  const key = process.env[`AFIP_KEY${suf}`];
  if (!cert || !key) return null;
  // Permite pegar el PEM con "\n" escapados en la variable de entorno.
  return { cert: cert.replace(/\\n/g, "\n"), key: key.replace(/\\n/g, "\n") };
}

// Construye y firma el LoginTicketRequest (CMS PKCS#7, DER, base64).
function firmarTra(cert: string, key: string, servicio: string): string {
  const ahora = new Date();
  const desde = new Date(ahora.getTime() - 10 * 60 * 1000);
  const hasta = new Date(ahora.getTime() + 10 * 60 * 1000);
  const uniqueId = Math.floor(ahora.getTime() / 1000);

  const tra =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<loginTicketRequest version="1.0">` +
    `<header>` +
    `<uniqueId>${uniqueId}</uniqueId>` +
    `<generationTime>${desde.toISOString()}</generationTime>` +
    `<expirationTime>${hasta.toISOString()}</expirationTime>` +
    `</header>` +
    `<service>${servicio}</service>` +
    `</loginTicketRequest>`;

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, "utf8");
  p7.addCertificate(cert);
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(key),
    certificate: forge.pki.certificateFromPem(cert),
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: ahora.toISOString() },
    ],
  });
  p7.sign();
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return forge.util.encode64(der);
}

// Devuelve un Token+Sign vigente: reutiliza el cacheado o pide uno nuevo a AFIP.
export async function obtenerTicketAcceso(opts: {
  cuit: string;
  ambiente: Ambiente;
  certEnv?: string | null;
  servicio?: string;
}): Promise<TicketAcceso> {
  const servicio = opts.servicio ?? "wsfe";

  // 1. ¿Hay token vigente en cache? (margen de 5 min)
  const margen = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { data: cache } = await sb
    .from("afip_tokens")
    .select("token, sign, expira_at")
    .eq("ambiente", opts.ambiente).eq("servicio", servicio).eq("cuit", opts.cuit)
    .gt("expira_at", margen)
    .order("expira_at", { ascending: false })
    .limit(1).maybeSingle();
  if (cache) return { token: cache.token, sign: cache.sign, expira: new Date(cache.expira_at) };

  // 2. Pedir uno nuevo
  const cred = credencialesDesdeEnv(opts.certEnv);
  if (!cred) throw new Error(`Faltan AFIP_CERT/AFIP_KEY${opts.certEnv ? `_${opts.certEnv}` : ""} en variables de entorno.`);

  const cms = firmarTra(cred.cert, cred.key, servicio);
  const soap =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">` +
    `<soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body>` +
    `</soapenv:Envelope>`;

  const res = await fetch(WSAA_URL[opts.ambiente], {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "" },
    body: soap,
  });
  const xml = await res.text();
  if (!res.ok) throw new Error(`WSAA HTTP ${res.status}: ${xml.slice(0, 300)}`);

  const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true });
  const env = parser.parse(xml);
  const ret = env?.Envelope?.Body?.loginCmsResponse?.loginCmsReturn;
  if (!ret) {
    const fault = env?.Envelope?.Body?.Fault?.faultstring;
    throw new Error(`WSAA: respuesta inesperada${fault ? ` (${fault})` : ""}: ${xml.slice(0, 300)}`);
  }
  // loginCmsReturn es XML (ya des-escapado por el parser) con credentials/header.
  const inner = parser.parse(ret);
  const cred2 = inner?.loginTicketResponse?.credentials;
  const header = inner?.loginTicketResponse?.header;
  if (!cred2?.token || !cred2?.sign) throw new Error("WSAA: no se pudo leer token/sign.");

  const expira = header?.expirationTime ? new Date(header.expirationTime) : new Date(Date.now() + 12 * 60 * 60 * 1000);

  // 3. Cachear
  await sb.from("afip_tokens").insert({
    ambiente: opts.ambiente, servicio, cuit: opts.cuit,
    token: String(cred2.token), sign: String(cred2.sign), expira_at: expira.toISOString(),
  });

  return { token: String(cred2.token), sign: String(cred2.sign), expira };
}
