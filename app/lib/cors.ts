// Helpers de CORS para los endpoints públicos del chatbot embebible.
// El widget corre en webs externas (WordPress, Wix, etc.), así que estos
// endpoints tienen que responder a cualquier origen. Son datos públicos
// (propiedades publicadas) y no usan cookies, por eso "*" es seguro acá.
import { NextResponse } from "next/server";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

// Respuesta JSON con headers de CORS ya puestos.
export function corsJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, { status: init?.status ?? 200, headers: CORS_HEADERS });
}

// Para el preflight OPTIONS.
export function corsPreflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
