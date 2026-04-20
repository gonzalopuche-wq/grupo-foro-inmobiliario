import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { match_id, user_id, es_duenio_ofrecido } = await req.json();

    if (!match_id || !user_id) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    // Buscar el match
    const { data: match } = await supabaseAdmin
      .from("mir_matches")
      .select("*")
      .eq("id", match_id)
      .single();

    if (!match) {
      return NextResponse.json({ error: "Match no encontrado" }, { status: 404 });
    }

    // Verificar si ya está desbloqueado por este lado
    const campoDesbloqueo = es_duenio_ofrecido ? "desbloqueado_ofrecido" : "desbloqueado_busqueda";
    if (match[campoDesbloqueo]) {
      return NextResponse.json({ ok: true, ya_desbloqueado: true });
    }

    // Obtener costo del match
    const { data: config } = await supabaseAdmin
      .from("indicadores")
      .select("valor")
      .eq("clave", "costo_match_mir")
      .single();

    const costo = config?.valor ?? 5000;

    // Registrar el pago del desbloqueo
    await supabaseAdmin.from("mir_desbloqueos").insert({
      match_id,
      user_id,
      monto: costo,
      tipo: es_duenio_ofrecido ? "ofrecido" : "busqueda",
    });

    // Actualizar el match
    await supabaseAdmin
      .from("mir_matches")
      .update({ [campoDesbloqueo]: true })
      .eq("id", match_id);

    // Si ambos desbloquearon, notificar a ambos con los datos de contacto
    const { data: matchActualizado } = await supabaseAdmin
      .from("mir_matches")
      .select("*, mir_ofrecidos(perfil_id), mir_busquedas(perfil_id)")
      .eq("id", match_id)
      .single();

    const ambosPagaron =
      (es_duenio_ofrecido ? true : match.desbloqueado_ofrecido) &&
      (es_duenio_ofrecido ? match.desbloqueado_busqueda : true);

    if (ambosPagaron && matchActualizado) {
      const ofPerfil = (matchActualizado.mir_ofrecidos as any)?.perfil_id;
      const buPerfil = (matchActualizado.mir_busquedas as any)?.perfil_id;

      // Buscar datos de contacto de ambos
      const { data: perfiles } = await supabaseAdmin
        .from("perfiles")
        .select("id, nombre, apellido, matricula, telefono, email")
        .in("id", [ofPerfil, buPerfil].filter(Boolean));

      const perfilOf = perfiles?.find(p => p.id === ofPerfil);
      const perfilBu = perfiles?.find(p => p.id === buPerfil);

      // Notificar a ambos
      for (const [uid, otro] of [[ofPerfil, perfilBu], [buPerfil, perfilOf]]) {
        if (!uid || !otro) continue;
        await supabaseAdmin.from("notificaciones").insert({
          user_id: uid,
          titulo: "¡Contacto desbloqueado!",
          mensaje: `${otro.nombre} ${otro.apellido} · Mat. ${otro.matricula ?? "—"} · ${otro.telefono ?? otro.email ?? ""}`,
          tipo: "match_mir",
          url: "/mir?vista=matches",
        });
      }
    }

    return NextResponse.json({ ok: true, ambos_desbloquearon: ambosPagaron });
  } catch (err) {
    console.error("Error en desbloqueo:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
