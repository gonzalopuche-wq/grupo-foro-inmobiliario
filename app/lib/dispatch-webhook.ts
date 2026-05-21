import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function dispatchWebhook(
  perfilId: string,
  evento: string,
  data: Record<string, unknown>
): Promise<void> {
  const { data: hooks } = await sb
    .from("gfi_webhooks")
    .select("id, url, secret")
    .eq("perfil_id", perfilId)
    .eq("activo", true)
    .contains("eventos", [evento]);

  if (!hooks?.length) return;

  const payload = JSON.stringify({ event: evento, data, timestamp: new Date().toISOString() });

  await Promise.allSettled(
    hooks.map(async (hook: { id: string; url: string; secret: string }) => {
      const sig = createHmac("sha256", hook.secret).update(payload).digest("hex");
      const start = Date.now();
      let ok = false;
      let status = 0;
      try {
        const res = await fetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-GFI-Signature": `sha256=${sig}`,
            "X-GFI-Event": evento,
          },
          body: payload,
          signal: AbortSignal.timeout(10_000),
        });
        ok = res.ok;
        status = res.status;
      } catch {
        ok = false;
      }
      const duracion = Date.now() - start;
      await sb.from("gfi_webhooks_log").insert({
        webhook_id: hook.id,
        perfil_id: perfilId,
        evento,
        status_code: status || null,
        ok,
        duracion_ms: duracion,
      });
      if (ok) {
        await sb.from("gfi_webhooks").update({ ultimo_envio: new Date().toISOString() }).eq("id", hook.id);
      }
    })
  );
}
