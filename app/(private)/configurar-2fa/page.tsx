"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "../../lib/supabase";

type Paso = "verificar" | "qr" | "confirmar" | "listo";

export default function Configurar2FAPage() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("verificar");
  const [cargando, setCargando] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    verificarEstado();
  }, []);

  async function verificarEstado() {
    setCargando(true);
    const { data } = await supabase.auth.mfa.listFactors();
    const totpActivo = data?.totp?.find(f => f.status === "verified");
    if (totpActivo) {
      setPaso("listo");
    } else {
      setPaso("qr");
      await iniciarEnrollment();
    }
    setCargando(false);
  }

  async function iniciarEnrollment() {
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "GFI® Grupo Foro Inmobiliario" });
    if (err || !data) {
      setError("No se pudo iniciar la configuración de 2FA. " + (err?.message ?? ""));
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setPaso("qr");
  }

  async function verificarCodigo() {
    if (!factorId || codigo.length !== 6) {
      setError("Ingresá el código de 6 dígitos.");
      return;
    }
    setProcesando(true);
    setError("");

    const { data: challenge, error: errChall } = await supabase.auth.mfa.challenge({ factorId });
    if (errChall || !challenge) {
      setError("Error al generar desafío: " + (errChall?.message ?? ""));
      setProcesando(false);
      return;
    }

    const { error: errVerify } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: codigo,
    });

    if (errVerify) {
      setError("Código incorrecto. Intentá nuevamente.");
      setProcesando(false);
      return;
    }

    // Marcar en perfiles
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("perfiles").update({
        mfa_habilitado: true,
        mfa_enrolled_at: new Date().toISOString(),
      }).eq("id", user.id);
    }

    setProcesando(false);
    setPaso("listo");
  }

  async function deshabilitarMfa() {
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp?.find(f => f.status === "verified");
    if (!factor) return;

    if (!confirm("¿Deshabilitar la autenticación de dos factores? Esto reduce la seguridad de tu cuenta.")) return;

    setProcesando(true);
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (err) { setError("Error al deshabilitar 2FA: " + err.message); setProcesando(false); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("perfiles").update({ mfa_habilitado: false, mfa_enrolled_at: null }).eq("id", user.id);
    }
    setProcesando(false);
    setPaso("qr");
    setCodigo("");
    await iniciarEnrollment();
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Verificando estado de seguridad...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Listo */}
        {paso === "listo" && (
          <div className="bg-gray-900 border border-green-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-green-400 mb-2">2FA Activo</h2>
            <p className="text-gray-300 mb-6">Tu cuenta está protegida con autenticación de dos factores. Cada vez que iniciés sesión necesitarás confirmar con tu app autenticadora.</p>
            <div className="space-y-3">
              <button
                onClick={() => router.push("/perfil")}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition"
              >
                Volver al perfil
              </button>
              <button
                onClick={deshabilitarMfa}
                disabled={procesando}
                className="w-full bg-transparent border border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-700 py-3 rounded-xl text-sm transition"
              >
                Deshabilitar 2FA
              </button>
            </div>
          </div>
        )}

        {/* QR Code */}
        {paso === "qr" && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🔐</div>
              <h2 className="text-2xl font-bold">Configurar 2FA</h2>
              <p className="text-gray-400 text-sm mt-2">Autenticación de dos factores — paso obligatorio para corredores GFI®</p>
            </div>

            <div className="bg-gray-800 rounded-xl p-5 mb-5">
              <h3 className="font-semibold mb-3 text-sm">Paso 1: Instalá una app autenticadora</h3>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                <div className="bg-gray-700 rounded-lg p-3 text-center">
                  <div className="text-2xl mb-1">📱</div>
                  <strong>Google Authenticator</strong>
                </div>
                <div className="bg-gray-700 rounded-lg p-3 text-center">
                  <div className="text-2xl mb-1">🔑</div>
                  <strong>Authy</strong>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-5 mb-5">
              <h3 className="font-semibold mb-3 text-sm">Paso 2: Escaneá el código QR</h3>
              {qrCode ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-white p-3 rounded-xl">
                    <Image src={qrCode} alt="QR 2FA" width={180} height={180} />
                  </div>
                  {secret && (
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1">O ingresá este código manualmente:</p>
                      <code className="text-xs bg-gray-700 px-3 py-1 rounded font-mono text-green-400 select-all">{secret}</code>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center">{error || "Generando QR..."}</p>
              )}
            </div>

            <div className="bg-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-3 text-sm">Paso 3: Ingresá el código de verificación</h3>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={codigo}
                onChange={e => { setCodigo(e.target.value.replace(/\D/g, "")); setError(""); }}
                placeholder="123456"
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest text-white placeholder-gray-500 mb-3"
              />
              {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}
              <button
                onClick={verificarCodigo}
                disabled={procesando || codigo.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white py-3 rounded-xl font-semibold transition"
              >
                {procesando ? "Verificando..." : "Activar 2FA"}
              </button>
            </div>

            <button
              onClick={() => router.push("/perfil")}
              className="w-full mt-3 text-sm text-gray-500 hover:text-gray-300 transition"
            >
              Configurar más tarde →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
