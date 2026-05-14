import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Image from "next/image";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Params { token: string }

async function getData(token: string) {
  const { data: pres } = await sb
    .from("crm_presentaciones")
    .select(`*, perfiles(nombre, apellido, foto_url, matricula, telefono, email, instagram, whatsapp_negocio, inmobiliaria)`)
    .eq("token", token)
    .eq("activa", true)
    .single();

  if (!pres) return null;

  // Incrementar vistas
  sb.from("crm_presentaciones").update({ vistas: (pres.vistas ?? 0) + 1 }).eq("token", token).then(() => {});

  const propIds = (pres.propiedades_ids ?? []) as string[];
  let propiedades: any[] = [];
  if (propIds.length > 0) {
    const { data: ps } = await sb
      .from("cartera_propiedades")
      .select("id, titulo, tipo_operacion, tipo_propiedad, precio, moneda, superficie_total, superficie_cubierta, dormitorios, banos, descripcion, fotos, direccion, barrio, localidad, expensas, garage")
      .in("id", propIds);

    // Mantener el orden de selección
    const mapa = new Map((ps ?? []).map(p => [p.id, p]));
    propiedades = propIds.map(id => mapa.get(id)).filter(Boolean);
  }

  return { pres, propiedades };
}

export default async function PresentacionPublicaPage({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const result = await getData(token);
  if (!result) notFound();

  const { pres, propiedades } = result;
  const agente = pres.perfiles as any;

  const vencida = pres.valid_until && new Date(pres.valid_until) < new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cabecera */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-6">
            {agente?.foto_url && (
              <div className="relative w-20 h-20 rounded-full overflow-hidden border-4 border-white/30 shrink-0">
                <Image src={agente.foto_url} alt={agente.nombre} fill className="object-cover" />
              </div>
            )}
            <div className="flex-1">
              <p className="text-blue-200 text-sm mb-1 font-medium uppercase tracking-wide">Presentación Comercial</p>
              <h1 className="text-3xl font-bold">{pres.titulo}</h1>
              {agente && (
                <p className="text-blue-200 mt-2 text-sm">
                  {agente.nombre} {agente.apellido}
                  {agente.matricula ? ` · Matr. ${agente.matricula}` : ""}
                  {agente.inmobiliaria ? ` · ${agente.inmobiliaria}` : ""}
                </p>
              )}
            </div>
          </div>

          {pres.mensaje && (
            <div className="mt-6 bg-white/10 rounded-xl p-4 text-sm leading-relaxed">
              {pres.mensaje}
            </div>
          )}

          {vencida && (
            <div className="mt-4 bg-red-500/20 border border-red-400/40 rounded-xl p-3 text-sm text-red-200">
              Esta presentación venció el {new Date(pres.valid_until!).toLocaleDateString("es-AR")}.
            </div>
          )}
        </div>
      </div>

      {/* Propiedades */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        <p className="text-gray-500 text-sm mb-6">{propiedades.length} propiedad{propiedades.length !== 1 ? "es" : ""} seleccionada{propiedades.length !== 1 ? "s" : ""}</p>

        <div className="grid gap-6 md:grid-cols-2">
          {propiedades.map((p: any, idx: number) => {
            const foto = (p.fotos ?? [])[0];
            return (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {foto ? (
                  <div className="relative h-48">
                    <Image src={foto} alt={p.titulo} fill className="object-cover" />
                    <div className="absolute top-3 left-3">
                      <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-48 bg-gray-100 flex items-center justify-center text-4xl text-gray-300">🏠</div>
                )}

                <div className="p-5">
                  <h2 className="font-bold text-gray-900 mb-1">{p.titulo}</h2>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full capitalize">{p.tipo_operacion}</span>
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full capitalize">{p.tipo_propiedad}</span>
                  </div>

                  {p.precio && (
                    <div className="text-2xl font-bold text-blue-700 mb-2">
                      {p.moneda === "USD" ? "U$S" : "$"} {p.precio.toLocaleString("es-AR")}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                    {p.dormitorios && <span>🛏 {p.dormitorios} dorm.</span>}
                    {p.banos && <span>🚿 {p.banos} baños</span>}
                    {p.superficie_total && <span>📐 {p.superficie_total} m² tot.</span>}
                    {p.superficie_cubierta && <span>📐 {p.superficie_cubierta} m² cub.</span>}
                    {p.expensas && <span>💰 Expensas ${p.expensas.toLocaleString("es-AR")}</span>}
                    {p.garage && <span>🚗 Cochera</span>}
                  </div>

                  {(p.barrio || p.localidad || p.direccion) && (
                    <p className="text-xs text-gray-500">
                      📍 {[p.direccion, p.barrio, p.localidad].filter(Boolean).join(", ")}
                    </p>
                  )}

                  {p.descripcion && (
                    <p className="text-sm text-gray-600 mt-3 line-clamp-3">{p.descripcion}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer agente */}
      {agente && (
        <div className="border-t border-gray-200 bg-white py-8 px-4">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-6">
            {agente.foto_url && (
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 shrink-0">
                <Image src={agente.foto_url} alt={agente.nombre} fill className="object-cover" />
              </div>
            )}
            <div className="flex-1 text-center md:text-left">
              <p className="font-bold text-gray-900">{agente.nombre} {agente.apellido}</p>
              {agente.inmobiliaria && <p className="text-gray-500 text-sm">{agente.inmobiliaria}</p>}
              {agente.matricula && <p className="text-gray-400 text-xs">Matrícula COCIR {agente.matricula}</p>}
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              {agente.whatsapp_negocio && (
                <a
                  href={`https://wa.me/${agente.whatsapp_negocio}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                >
                  WhatsApp
                </a>
              )}
              {agente.telefono && (
                <a
                  href={`tel:${agente.telefono}`}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                >
                  Llamar
                </a>
              )}
              {agente.email && (
                <a
                  href={`mailto:${agente.email}`}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                >
                  Email
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="text-center py-4 text-xs text-gray-400">
        Presentación generada con GFI® — Grupo Foro Inmobiliario
      </div>
    </div>
  );
}
