import { supabase } from "./supabase";

export async function enviarEmail(to: string, subject: string, html: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  await fetch("/api/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ to, subject, html }),
  });
}
