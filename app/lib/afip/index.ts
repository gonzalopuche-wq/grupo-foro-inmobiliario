// Helpers de alto nivel para facturación AFIP. SOLO SERVIDOR.
import "server-only";

export { obtenerTicketAcceso, credencialesDesdeEnv } from "./wsaa";
export type { Ambiente } from "./wsaa";
export { solicitarCAE, ultimoComprobante } from "./wsfe";
export type { Auth, ComprobanteInput, ResultadoCAE } from "./wsfe";

export type CondicionIva = "RI" | "MT" | "CF" | "EX";

// Determina el tipo de comprobante según la condición del emisor y del receptor.
// 1=Factura A · 6=Factura B · 11=Factura C
export function tipoComprobante(emisor: CondicionIva, receptor: CondicionIva | null): number {
  if (emisor === "MT") return 11;                 // Monotributista emite C
  // Emisor Responsable Inscripto:
  return receptor === "RI" ? 1 : 6;               // A si el receptor es RI, sino B
}

// Tipo y número de documento del receptor para AFIP.
// 80=CUIT · 96=DNI · 99=Consumidor Final (sin identificar)
export function docReceptor(cuit: string | null, dni: string | null): { docTipo: number; docNro: string } {
  const soloDigitos = (s: string) => s.replace(/\D/g, "");
  if (cuit && soloDigitos(cuit).length === 11) return { docTipo: 80, docNro: soloDigitos(cuit) };
  if (dni && soloDigitos(dni).length >= 7) return { docTipo: 96, docNro: soloDigitos(dni) };
  return { docTipo: 99, docNro: "0" };
}

export function hoyYyyymmdd(d = new Date()): string {
  // Fecha en horario de Argentina (UTC-3) para que CbteFch coincida con AFIP.
  const ar = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return ar.toISOString().slice(0, 10).replace(/-/g, "");
}

// Construye la URL del QR fiscal de AFIP a partir de los datos del comprobante.
export function construirQrAfip(p: {
  fecha: string;            // 'YYYY-MM-DD'
  cuit: number;
  ptoVta: number;
  tipoCmp: number;
  nroCmp: number;
  importe: number;
  tipoDocRec: number;
  nroDocRec: number;
  cae: string;
}): string {
  const data = {
    ver: 1,
    fecha: p.fecha,
    cuit: p.cuit,
    ptoVta: p.ptoVta,
    tipoCmp: p.tipoCmp,
    nroCmp: p.nroCmp,
    importe: p.importe,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: p.tipoDocRec,
    nroDocRec: p.nroDocRec,
    tipoCodAut: "E",
    codAut: Number(p.cae),
  };
  const b64 = Buffer.from(JSON.stringify(data)).toString("base64");
  return `https://www.afip.gob.ar/fe/qr/?p=${b64}`;
}
