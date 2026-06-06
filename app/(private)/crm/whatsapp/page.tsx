"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface Estado {
  conectado: boolean;
  env: { phone_id: boolean; access_token: boolean; app_secret: boolean; verify_token: boolean };
  verify_token: string | null;
  webhook_url: string;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginBottom: 5, fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          readOnly
          value={value}
          style={{ flex: 1, padding: "9px 12px", borderRadius: 6, border: "1px solid var(--gfi-border)", background: "var(--gfi-bg-secondary)", color: "var(--gfi-text-primary)", fontSize: 12, fontFamily: "var(--font-mono)" }}
          onFocus={e => e.currentTarget.select()}
        />
        <button
          onClick={() => { navigator.clipboard.writeText(value); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}
          style={{ padding: "0 14px", borderRadius: 6, border: "1px solid var(--gfi-border)", background: copiado ? "rgba(58,186,182,0.15)" : "var(--gfi-bg-secondary)", color: copiado ? "var(--gfi-teal-text)" : "var(--gfi-text-secondary)", cursor: "pointer", fontSize: 12, flexShrink: 0 }}
        >
          {copiado ? "✓" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: ok ? "var(--gfi-text-secondary)" : "var(--gfi-text-muted)", padding: "4px 0" }}>
      <span style={{ color: ok ? "var(--gfi-teal-text)" : "var(--gfi-red)" }}>{ok ? "✓" : "✗"}</span>
      <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{label}</code>
      <span style={{ marginLeft: "auto", fontSize: 11, color: ok ? "var(--gfi-teal-text)" : "var(--gfi-red)" }}>{ok ? "configurada" : "falta"}</span>
    </div>
  );
}

export default function WhatsAppConfigPage() {
  const [token, setToken] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [miNumero, setMiNumero] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [loading, setLoading] = useState(true);

  // Test send
  const [testTo, setTestTo] = useState("");
  const [testMsg, setTestMsg] = useState("Mensaje de prueba desde GFI® 👋");
  const [enviando, setEnviando] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      setToken(session.access_token);
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("tipo, whatsapp_negocio")
        .eq("id", session.user.id)
        .single();
      const admin = perfil?.tipo === "admin" || perfil?.tipo === "master";
      setEsAdmin(admin);
      setMiNumero(perfil?.whatsapp_negocio ?? null);
      if (admin) {
        const res = await fetch("/api/whatsapp/estado", { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (res.ok) setEstado(await res.json());
      }
      setLoading(false);
    })();
  }, []);

  const enviarTest = async () => {
    if (!token || !testTo.trim() || !testMsg.trim()) return;
    setEnviando(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: testTo.trim(), body: testMsg.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) setTestResult({ ok: true, msg: "Mensaje enviado correctamente." });
      else setTestResult({ ok: false, msg: data.error ?? "No se pudo enviar." });
    } catch {
      setTestResult({ ok: false, msg: "Error de red." });
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: "var(--gfi-text-muted)" }}>Cargando…</div>;

  const card: React.CSSProperties = {
    border: "1px solid var(--gfi-border-subtle)", borderRadius: 12,
    background: "var(--gfi-bg-card, rgba(255,255,255,0.02))", padding: "20px 22px", marginBottom: 18,
  };
  const titulo: React.CSSProperties = {
    fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 800, letterSpacing: "0.14em",
    textTransform: "uppercase", color: "var(--gfi-text-muted)", marginBottom: 14,
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "var(--gfi-text-primary)", margin: "0 0 6px" }}>
        WhatsApp <span style={{ color: "#25d366" }}>·</span> Meta Cloud API
      </h1>
      <p style={{ fontSize: 13, color: "var(--gfi-text-muted)", margin: "0 0 22px", lineHeight: 1.6 }}>
        Conectá WhatsApp para automatizar la carga al MIR y responder consultas desde la bandeja de entrada del CRM.
      </p>

      {/* Tu número (todos) */}
      <div style={card}>
        <div style={titulo}>Tu número de WhatsApp Negocio</div>
        {miNumero ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--gfi-text-primary)" }}>
            <span style={{ color: "var(--gfi-teal-text)" }}>✓</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>{miNumero}</span>
            <Link href="/perfil" style={{ marginLeft: "auto", fontSize: 12, color: "var(--gfi-text-muted)", textDecoration: "underline" }}>Cambiar en mi perfil</Link>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--gfi-text-secondary)", lineHeight: 1.6 }}>
            Todavía no vinculaste un número. Agregalo en tu{" "}
            <Link href="/perfil" style={{ color: "var(--gfi-teal-text)", textDecoration: "underline" }}>perfil</Link>{" "}
            (campo «WhatsApp Negocio») para que tus mensajes se carguen automáticamente al MIR.
          </div>
        )}
      </div>

      {!esAdmin ? (
        <div style={{ ...card, background: "rgba(74,184,216,0.06)", border: "1px solid rgba(74,184,216,0.2)" }}>
          <div style={{ fontSize: 13, color: "var(--gfi-text-secondary)", lineHeight: 1.6 }}>
            La conexión de la API de Meta la gestiona el equipo de GFI®. Una vez activa, podés responder tus
            consultas de WhatsApp y email desde la{" "}
            <Link href="/crm/inbox" style={{ color: "var(--gfi-teal-text)", textDecoration: "underline" }}>bandeja de entrada</Link>.
          </div>
        </div>
      ) : (
        <>
          {/* Estado de conexión */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={titulo}>Estado de la conexión</div>
              <span style={{
                fontSize: 11, fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: "0.1em", textTransform: "uppercase",
                padding: "4px 12px", borderRadius: 20,
                background: estado?.conectado ? "rgba(37,211,102,0.14)" : "rgba(196,74,0,0.12)",
                color: estado?.conectado ? "#25d366" : "#d4960c",
                border: `1px solid ${estado?.conectado ? "rgba(37,211,102,0.35)" : "rgba(196,74,0,0.3)"}`,
              }}>
                {estado?.conectado ? "● Conectado" : "○ No conectado"}
              </span>
            </div>
            {estado && (
              <div>
                <Check ok={estado.env.phone_id} label="WHATSAPP_PHONE_ID" />
                <Check ok={estado.env.access_token} label="WHATSAPP_ACCESS_TOKEN" />
                <Check ok={estado.env.app_secret} label="WHATSAPP_APP_SECRET" />
                <Check ok={estado.env.verify_token} label="WHATSAPP_VERIFY_TOKEN" />
              </div>
            )}
            <p style={{ fontSize: 12, color: "var(--gfi-text-muted)", marginTop: 12, lineHeight: 1.6 }}>
              Estas variables se configuran en el entorno (Vercel → Settings → Environment Variables). Después de
              agregarlas o cambiarlas hay que volver a desplegar.
            </p>
          </div>

          {/* Configuración del webhook en Meta */}
          {estado && (
            <div style={card}>
              <div style={titulo}>Configurar webhook en Meta</div>
              <CopyRow label="Callback URL" value={estado.webhook_url} />
              <CopyRow label="Verify token" value={estado.verify_token ?? "(definí WHATSAPP_VERIFY_TOKEN en el entorno)"} />
              <p style={{ fontSize: 12, color: "var(--gfi-text-muted)", marginTop: 8, lineHeight: 1.7 }}>
                En <strong style={{ color: "var(--gfi-text-secondary)" }}>Meta for Developers → WhatsApp → Configuration</strong>:
                pegá la Callback URL y el Verify token, verificá y suscribite al campo <code>messages</code>.
              </p>
            </div>
          )}

          {/* Prueba de envío */}
          <div style={card}>
            <div style={titulo}>Probar envío</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                placeholder="Número destino (ej: 5493412345678)"
                value={testTo}
                onChange={e => setTestTo(e.target.value)}
                style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid var(--gfi-border)", background: "var(--gfi-bg-secondary)", color: "var(--gfi-text-primary)", fontSize: 13 }}
              />
              <textarea
                value={testMsg}
                onChange={e => setTestMsg(e.target.value)}
                rows={2}
                style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid var(--gfi-border)", background: "var(--gfi-bg-secondary)", color: "var(--gfi-text-primary)", fontSize: 13, resize: "vertical", fontFamily: "var(--font-body)" }}
              />
              <button
                onClick={enviarTest}
                disabled={enviando || !testTo.trim() || !testMsg.trim()}
                style={{
                  alignSelf: "flex-start", padding: "9px 18px", borderRadius: 5, border: "none",
                  background: enviando ? "rgba(37,211,102,0.3)" : "#25d366",
                  color: "#062b15", cursor: enviando ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
                }}
              >
                {enviando ? "Enviando…" : "Enviar prueba"}
              </button>
              {testResult && (
                <div style={{ fontSize: 13, color: testResult.ok ? "var(--gfi-teal-text)" : "var(--gfi-red)" }}>
                  {testResult.ok ? "✓ " : "✗ "}{testResult.msg}
                </div>
              )}
            </div>
            <p style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginTop: 10, lineHeight: 1.6 }}>
              Nota: WhatsApp solo permite enviar mensajes libres dentro de la ventana de 24 h desde el último
              mensaje del usuario. Fuera de esa ventana se requieren plantillas aprobadas por Meta.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
