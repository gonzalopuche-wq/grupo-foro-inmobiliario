// IA Home staging — amobla habitaciones vacías o cambia el estilo de un ambiente.
// Usa Gemini 2.5 Flash Image (edición imagen→imagen).
// Requiere: GEMINI_API_KEY (o GOOGLE_GENERATIVE_AI_API_KEY) en variables de entorno.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const GEMINI_MODEL = "gemini-2.5-flash-image";

const ESTILOS: Record<string, string> = {
  moderno: "Amoblá y decorá este ambiente con un estilo moderno minimalista: muebles contemporáneos, líneas limpias y colores neutros.",
  clasico: "Amoblá y decorá este ambiente con un estilo clásico y elegante: muebles tradicionales, tonos cálidos y decoración sofisticada.",
  nordico: "Amoblá y decorá este ambiente con estilo nórdico escandinavo: madera natural, paredes blancas y un ambiente acogedor.",
  industrial: "Amoblá y decorá este ambiente con estilo industrial: muebles de metal y madera, ladrillo a la vista y detalles urbanos.",
  premium: "Amoblá y decorá este ambiente con un estilo premium de lujo: muebles de alta gama, materiales nobles y terminaciones elegantes.",
  vacio: "Quitá todos los muebles, objetos y desorden para mostrar el ambiente completamente vacío, limpio y listo para mostrar.",
};

// Guard anti-SSRF: https y sin apuntar a hosts internos/privados/metadata.
function fotoEntradaSegura(rawUrl: string): boolean {
  let u: URL;
  try { u = new URL(rawUrl); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host.endsWith(".localhost")) return false;
  // IPs literales privadas / reservadas / metadata de nube
  const privados = [
    /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^0\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./, /^::1$/, /^fe80:/i, /^fc00:/i, /^fd00:/i,
  ];
  if (privados.some(re => re.test(host))) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const authToken = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authToken) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const { data: authData, error: authErr } = await sb.auth.getUser(authToken);
    if (authErr || !authData?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { foto_url, estilo = "moderno" } = await req.json();
    if (!foto_url) return NextResponse.json({ error: "foto_url requerida" }, { status: 400 });
    if (!fotoEntradaSegura(foto_url)) {
      return NextResponse.json({ error: "La URL de la foto no es válida o no está permitida." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: "GEMINI_API_KEY no configurada. Agregala en las variables de entorno de Vercel para usar el home staging con IA.",
        pendiente: true,
      }, { status: 400 });
    }

    // Descargar la imagen de entrada
    let inputBase64 = "";
    let inputMime = "image/jpeg";
    try {
      const imgRes = await fetch(foto_url);
      if (!imgRes.ok) return NextResponse.json({ error: "No se pudo descargar la foto de base." }, { status: 502 });
      inputMime = imgRes.headers.get("content-type")?.split(";")[0] || "image/jpeg";
      const buf = Buffer.from(await imgRes.arrayBuffer());
      inputBase64 = buf.toString("base64");
    } catch {
      return NextResponse.json({ error: "Error al descargar la foto de base." }, { status: 502 });
    }

    const estiloPrompt = ESTILOS[estilo] ?? ESTILOS.moderno;
    const prompt =
      `${estiloPrompt} ` +
      "Mantené intacta la arquitectura: paredes, ventanas, puertas, pisos, techos, dimensiones y la perspectiva de la cámara. " +
      "No agregues personas ni texto. El resultado debe ser fotorrealista, con calidad de fotografía inmobiliaria profesional y buena iluminación natural. " +
      "Devolvé únicamente la imagen editada.";

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const genRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: inputMime, data: inputBase64 } },
          ],
        }],
      }),
    });

    if (!genRes.ok) {
      const errTxt = await genRes.text();
      return NextResponse.json({ error: `Error de Gemini: ${errTxt.slice(0, 300)}` }, { status: 502 });
    }

    const genJson = await genRes.json();
    const parts = genJson?.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p: { inlineData?: { data?: string; mimeType?: string } }) => p?.inlineData?.data);

    if (!imgPart?.inlineData?.data) {
      const textPart = parts.find((p: { text?: string }) => p?.text)?.text;
      return NextResponse.json({
        error: textPart ? `La IA no devolvió una imagen: ${textPart.slice(0, 200)}` : "La IA no devolvió una imagen.",
      }, { status: 502 });
    }

    const outMime = imgPart.inlineData.mimeType || "image/png";
    // Subimos la imagen generada al bucket y devolvemos su URL pública en lugar de
    // un data URL base64: así no hay que reenviar varios MB al guardar (límite de
    // 4.5 MB del body en Vercel) y baja el consumo de ancho de banda en el cliente.
    const outBuffer = Buffer.from(imgPart.inlineData.data, "base64");
    const ext = outMime.includes("jpeg") || outMime.includes("jpg") ? "jpg" : outMime.includes("webp") ? "webp" : "png";
    const path = `${authData.user.id}/staging-ia-${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage
      .from("fotos_cartera")
      .upload(path, outBuffer, { cacheControl: "3600", upsert: false, contentType: outMime });
    if (upErr) {
      return NextResponse.json({ error: `No se pudo guardar la imagen generada: ${upErr.message}` }, { status: 500 });
    }
    const { data: urlData } = sb.storage.from("fotos_cartera").getPublicUrl(path);
    return NextResponse.json({ ok: true, url: urlData.publicUrl, estilo });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
