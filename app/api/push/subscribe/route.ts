import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { subscription, perfil_id, eventos } = await req.json();

    if (!subscription?.endpoint || !perfil_id) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    const { error } = await supabase.from("push_subscriptions").upsert({
      perfil_id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      eventos: eventos ?? true,
    }, { onConflict: "perfil_id,endpoint" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { perfil_id, endpoint } = await req.json();
    await supabase.from("push_subscriptions")
      .delete()
      .eq("perfil_id", perfil_id)
      .eq("endpoint", endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
