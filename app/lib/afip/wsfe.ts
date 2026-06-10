// ─────────────────────────────────────────────────────────────────────────────
// WSFE — Facturación Electrónica AFIP (wsfev1). SOLO SERVIDOR.
// Implementa lo necesario para emitir comprobantes: último autorizado + CAE.
// ─────────────────────────────────────────────────────────────────────────────
import "server-only";
import { XMLParser } from "fast-xml-parser";
import type { Ambiente } from "./wsaa";

const WSFE_URL: Record<Ambiente, string> = {
  homologacion: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  produccion: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
};
const NS = "http://ar.gov.afip.dif.FEV1/";

export interface Auth { token: string; sign: string; cuit: string; }

const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true });

async function llamar(ambiente: Ambiente, accion: string, bodyInner: string): Promise<any> {
  const soap =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ar="${NS}">` +
    `<soap:Body>${bodyInner}</soap:Body></soap:Envelope>`;
  const res = await fetch(WSFE_URL[ambiente], {
    method: "POST",
    headers: { "Content-Type": `application/soap+xml; charset=utf-8; action="${NS}${accion}"` },
    body: soap,
  });
  const xml = await res.text();
  if (!res.ok) throw new Error(`WSFE HTTP ${res.status}: ${xml.slice(0, 400)}`);
  return parser.parse(xml)?.Envelope?.Body;
}

function authXml(a: Auth): string {
  return `<ar:Auth><ar:Token>${a.token}</ar:Token><ar:Sign>${a.sign}</ar:Sign><ar:Cuit>${a.cuit}</ar:Cuit></ar:Auth>`;
}

// Último número de comprobante autorizado para un punto de venta + tipo.
export async function ultimoComprobante(ambiente: Ambiente, auth: Auth, ptoVta: number, cbteTipo: number): Promise<number> {
  const body = `<ar:FECompUltimoAutorizado>${authXml(auth)}<ar:PtoVta>${ptoVta}</ar:PtoVta><ar:CbteTipo>${cbteTipo}</ar:CbteTipo></ar:FECompUltimoAutorizado>`;
  const r = await llamar(ambiente, "FECompUltimoAutorizado", body);
  const result = r?.FECompUltimoAutorizadoResponse?.FECompUltimoAutorizadoResult;
  const err = extraerErrores(result);
  if (err) throw new Error(`WSFE FECompUltimoAutorizado: ${err}`);
  return Number(result?.CbteNro ?? 0);
}

export interface ComprobanteInput {
  ptoVta: number;
  cbteTipo: number;       // 1=Fac A, 6=Fac B, 11=Fac C
  concepto: number;       // 1=productos, 2=servicios, 3=ambos
  docTipo: number;        // 80=CUIT, 96=DNI, 99=Cons.Final
  docNro: string;         // sin guiones
  cbteFch: string;        // yyyymmdd
  impNeto: number;
  impIVA: number;
  impTotal: number;
  ivaId: number;          // 5=21%, 4=10.5%, 3=0%
  fchServDesde?: string;  // yyyymmdd (concepto 2/3)
  fchServHasta?: string;
  fchVtoPago?: string;
}

export interface ResultadoCAE {
  resultado: "A" | "R" | string;
  cae: string | null;
  caeVto: string | null;   // yyyymmdd
  cbteNro: number;
  observaciones: string | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// Solicita el CAE para el próximo comprobante (calcula el número = último + 1).
export async function solicitarCAE(ambiente: Ambiente, auth: Auth, c: ComprobanteInput): Promise<ResultadoCAE> {
  const ultimo = await ultimoComprobante(ambiente, auth, c.ptoVta, c.cbteTipo);
  const nro = ultimo + 1;

  // Para comprobantes C (monotributo/sujeto no RI) no se discrimina IVA.
  const esC = c.cbteTipo === 11 || c.cbteTipo === 13;
  const impNeto = esC ? r2(c.impTotal) : r2(c.impNeto);
  const impIVA = esC ? 0 : r2(c.impIVA);
  const impTotal = r2(c.impTotal);

  const ivaXml = esC ? "" :
    `<ar:Iva><ar:AlicIva><ar:Id>${c.ivaId}</ar:Id><ar:BaseImp>${impNeto}</ar:BaseImp><ar:Importe>${impIVA}</ar:Importe></ar:AlicIva></ar:Iva>`;

  const fechasServ = (c.concepto === 2 || c.concepto === 3)
    ? `<ar:FchServDesde>${c.fchServDesde ?? c.cbteFch}</ar:FchServDesde><ar:FchServHasta>${c.fchServHasta ?? c.cbteFch}</ar:FchServHasta><ar:FchVtoPago>${c.fchVtoPago ?? c.cbteFch}</ar:FchVtoPago>`
    : "";

  const det =
    `<ar:FECAEDetRequest>` +
    `<ar:Concepto>${c.concepto}</ar:Concepto>` +
    `<ar:DocTipo>${c.docTipo}</ar:DocTipo>` +
    `<ar:DocNro>${c.docNro}</ar:DocNro>` +
    `<ar:CbteDesde>${nro}</ar:CbteDesde>` +
    `<ar:CbteHasta>${nro}</ar:CbteHasta>` +
    `<ar:CbteFch>${c.cbteFch}</ar:CbteFch>` +
    `<ar:ImpTotal>${impTotal}</ar:ImpTotal>` +
    `<ar:ImpTotConc>0</ar:ImpTotConc>` +
    `<ar:ImpNeto>${impNeto}</ar:ImpNeto>` +
    `<ar:ImpOpEx>0</ar:ImpOpEx>` +
    `<ar:ImpIVA>${impIVA}</ar:ImpIVA>` +
    `<ar:ImpTrib>0</ar:ImpTrib>` +
    fechasServ +
    `<ar:MonId>PES</ar:MonId>` +
    `<ar:MonCotiz>1</ar:MonCotiz>` +
    ivaXml +
    `</ar:FECAEDetRequest>`;

  const body =
    `<ar:FECAESolicitar>${authXml(auth)}<ar:FeCAEReq>` +
    `<ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${c.ptoVta}</ar:PtoVta><ar:CbteTipo>${c.cbteTipo}</ar:CbteTipo></ar:FeCabReq>` +
    `<ar:FeDetReq>${det}</ar:FeDetReq>` +
    `</ar:FeCAEReq></ar:FECAESolicitar>`;

  const r = await llamar(ambiente, "FECAESolicitar", body);
  const result = r?.FECAESolicitarResponse?.FECAESolicitarResult;
  const errTop = extraerErrores(result);
  if (errTop) throw new Error(`WSFE FECAESolicitar: ${errTop}`);

  const cab = result?.FeCabResp;
  const det0 = result?.FeDetResp?.FECAEDetResponse;
  const obs = extraerObservaciones(det0);

  return {
    resultado: cab?.Resultado ?? det0?.Resultado ?? "R",
    cae: det0?.CAE ? String(det0.CAE) : null,
    caeVto: det0?.CAEFchVto ? String(det0.CAEFchVto) : null,
    cbteNro: nro,
    observaciones: obs,
  };
}

function extraerErrores(result: any): string | null {
  const errs = result?.Errors?.Err;
  if (!errs) return null;
  const arr = Array.isArray(errs) ? errs : [errs];
  return arr.map((e: any) => `[${e?.Code}] ${e?.Msg}`).join(" · ") || null;
}

function extraerObservaciones(det: any): string | null {
  const obs = det?.Observaciones?.Obs;
  if (!obs) return null;
  const arr = Array.isArray(obs) ? obs : [obs];
  return arr.map((o: any) => `[${o?.Code}] ${o?.Msg}`).join(" · ") || null;
}
