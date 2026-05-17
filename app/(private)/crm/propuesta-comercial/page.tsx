"use client";

import { useState, useMemo, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DatosPropietario {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  direccionPropiedad: string;
  barrio: string;
  ciudad: string;
}

interface DatosInmueble {
  tipo: string;
  ambientes: number;
  superficie: number;
  piso: string;
  caracteristicas: string[];
  estado: string;
  antiguedad: number;
  expensas: number;
}

interface DatosOperacion {
  tipoOperacion: "venta" | "alquiler" | "ambas";
  valorEstimado: number;
  moneda: "USD" | "ARS";
  honorariosPct: number;
  exclusiva: boolean;
  plazoExclusiva: number;
  estrategiaDifusion: string[];
}

interface DatosAgencia {
  nombreAgencia: string;
  nombreCorredor: string;
  matriculaCorredor: string;
  telefonoCorredor: string;
  emailCorredor: string;
  logoUrl: string;
  anosExperiencia: number;
  propiedadesVendidas: number;
  ventajasCompetitivas: string[];
}

interface Propuesta {
  id: string;
  propietario: DatosPropietario;
  inmueble: DatosInmueble;
  operacion: DatosOperacion;
  agencia: DatosAgencia;
  createdAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "crm_propuestas_v1";

const PORTALES_OPCIONES = [
  "ZonaProp",
  "Argenprop",
  "MercadoLibre",
  "Inmuebles24",
  "Portal Inmobiliario",
  "Instagram / Facebook Ads",
  "Base de datos GFI",
  "Red de corredores GFI",
  "WhatsApp / Email marketing",
  "Google Ads",
];

const CARACTERISTICAS_OPCIONES = [
  "Cochera",
  "Jardín",
  "Terraza",
  "Balcón",
  "Amenities",
  "Pileta",
  "SUM",
  "Gimnasio",
  "Seguridad 24h",
  "Apto profesional",
  "Luminoso",
  "Vista panorámica",
];

const TIPOS_INMUEBLE = [
  "Departamento",
  "Casa",
  "Duplex",
  "Triplex",
  "PH",
  "Oficina",
  "Local comercial",
  "Terreno",
  "Cochera",
  "Otro",
];

const ESTADOS_INMUEBLE = ["Excelente", "Muy bueno", "Bueno", "Regular", "A refaccionar"];

const VENTAJAS_DEFAULT = [
  "Asesoramiento personalizado durante todo el proceso",
  "Amplia base de compradores activos calificados",
  "Difusión en los principales portales del país",
  "Gestión integral de documentación",
  "Red de profesionales asociados GFI",
];

// ─── Default values ───────────────────────────────────────────────────────────

const defaultPropietario = (): DatosPropietario => ({
  nombre: "",
  apellido: "",
  email: "",
  telefono: "",
  direccionPropiedad: "",
  barrio: "",
  ciudad: "",
});

const defaultInmueble = (): DatosInmueble => ({
  tipo: "Departamento",
  ambientes: 2,
  superficie: 0,
  piso: "",
  caracteristicas: [],
  estado: "Muy bueno",
  antiguedad: 0,
  expensas: 0,
});

const defaultOperacion = (): DatosOperacion => ({
  tipoOperacion: "venta",
  valorEstimado: 0,
  moneda: "USD",
  honorariosPct: 3,
  exclusiva: true,
  plazoExclusiva: 3,
  estrategiaDifusion: ["ZonaProp", "Argenprop", "MercadoLibre", "Base de datos GFI", "Red de corredores GFI"],
});

const defaultAgencia = (): DatosAgencia => ({
  nombreAgencia: "",
  nombreCorredor: "",
  matriculaCorredor: "",
  telefonoCorredor: "",
  emailCorredor: "",
  logoUrl: "",
  anosExperiencia: 10,
  propiedadesVendidas: 200,
  ventajasCompetitivas: [...VENTAJAS_DEFAULT],
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadPropuestas(): Propuesta[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Propuesta[];
  } catch {
    return [];
  }
}

function savePropuestas(list: Propuesta[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function loadAgenciaDefecto(): DatosAgencia {
  try {
    const raw = localStorage.getItem("crm_agencia_defecto_v1");
    if (!raw) return defaultAgencia();
    return JSON.parse(raw) as DatosAgencia;
  } catch {
    return defaultAgencia();
  }
}

function saveAgenciaDefecto(a: DatosAgencia): void {
  localStorage.setItem("crm_agencia_defecto_v1", JSON.stringify(a));
}

function fmtMoneda(valor: number, moneda: "USD" | "ARS"): string {
  if (moneda === "USD") {
    return `U$S ${valor.toLocaleString("es-AR")}`;
  }
  return `$ ${valor.toLocaleString("es-AR")}`;
}

function tituloOperacion(op: "venta" | "alquiler" | "ambas"): string {
  if (op === "venta") return "Venta";
  if (op === "alquiler") return "Alquiler";
  return "Comercialización";
}

function inicialesAgencia(nombre: string): string {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function fechaHoy(): string {
  return new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ─── PDF Generator ────────────────────────────────────────────────────────────

function generarPDF(propuesta: Propuesta): void {
  const { propietario, inmueble, operacion, agencia } = propuesta;
  const iniciales = inicialesAgencia(agencia.nombreAgencia || "GFI");
  const titulo = `Propuesta de ${tituloOperacion(operacion.tipoOperacion)}`;
  const montoHonorarios =
    operacion.valorEstimado > 0
      ? fmtMoneda(
          Math.round((operacion.valorEstimado * operacion.honorariosPct) / 100),
          operacion.moneda
        )
      : "A convenir";

  const difusionItems = operacion.estrategiaDifusion
    .map(
      (d) =>
        `<li style="margin:6px 0; display:flex; align-items:center; gap:8px;">
          <span style="width:18px;height:18px;background:#cc0000;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:10px;flex-shrink:0;">✓</span>
          <span>${d}</span>
        </li>`
    )
    .join("");

  const caracteristicasBadges = inmueble.caracteristicas
    .map(
      (c) =>
        `<span style="display:inline-block;background:#f3f3f3;border:1px solid #e0e0e0;border-radius:20px;padding:4px 12px;font-size:12px;margin:3px;">${c}</span>`
    )
    .join("");

  const ventajasItems = agencia.ventajasCompetitivas
    .map(
      (v) =>
        `<li style="margin:8px 0; padding-left:22px; position:relative;">
          <span style="position:absolute;left:0;color:#cc0000;font-weight:700;">›</span>${v}
        </li>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo} — ${propietario.apellido}, ${propietario.nombre}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', Arial, sans-serif;
    background: #fff;
    color: #111;
    font-size: 14px;
    line-height: 1.6;
  }
  .page {
    max-width: 780px;
    margin: 0 auto;
    padding: 2cm;
  }
  h1, h2, h3 {
    font-family: 'Montserrat', Arial, sans-serif;
    font-weight: 800;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 20px;
    padding-bottom: 24px;
    border-bottom: 3px solid #cc0000;
    margin-bottom: 28px;
  }
  .logo-circle {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: #cc0000;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Montserrat', Arial, sans-serif;
    font-weight: 800;
    font-size: 22px;
    flex-shrink: 0;
  }
  .header-info h2 {
    font-size: 20px;
    color: #111;
    margin-bottom: 4px;
  }
  .header-info p {
    font-size: 12px;
    color: #555;
    margin: 1px 0;
  }
  .titulo-propuesta {
    margin-bottom: 28px;
  }
  .titulo-propuesta h1 {
    font-size: 28px;
    color: #cc0000;
    margin-bottom: 4px;
  }
  .titulo-propuesta .subtitulo {
    font-size: 16px;
    color: #333;
    font-family: 'Montserrat', Arial, sans-serif;
    font-weight: 700;
  }
  .fecha-emision {
    font-size: 12px;
    color: #888;
    margin-top: 6px;
  }
  .seccion {
    background: #fafafa;
    border: 1px solid #ebebeb;
    border-left: 4px solid #cc0000;
    border-radius: 8px;
    padding: 20px 22px;
    margin-bottom: 18px;
    page-break-inside: avoid;
  }
  .seccion h3 {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #cc0000;
    margin-bottom: 12px;
  }
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 20px;
  }
  .dato {
    display: flex;
    flex-direction: column;
  }
  .dato .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #999;
    margin-bottom: 1px;
  }
  .dato .valor {
    font-size: 14px;
    font-weight: 600;
    color: #111;
  }
  .valor-principal {
    font-family: 'Montserrat', Arial, sans-serif;
    font-weight: 800;
    font-size: 26px;
    color: #cc0000;
    margin: 8px 0;
  }
  .comparables-note {
    font-size: 12px;
    color: #666;
    font-style: italic;
  }
  .honorarios-badge {
    display: inline-block;
    background: #cc0000;
    color: #fff;
    padding: 6px 18px;
    border-radius: 20px;
    font-family: 'Montserrat', Arial, sans-serif;
    font-weight: 800;
    font-size: 18px;
    margin: 6px 0;
  }
  .exclusiva-box {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #fff3f3;
    border: 1px solid #ffc0c0;
    border-radius: 8px;
    padding: 8px 14px;
    margin-top: 10px;
  }
  .exclusiva-box .check {
    color: #cc0000;
    font-weight: 700;
    font-size: 16px;
  }
  ul.difusion {
    list-style: none;
    padding: 0;
    columns: 2;
    column-gap: 20px;
  }
  ul.ventajas {
    list-style: none;
    padding: 0;
  }
  .stats-row {
    display: flex;
    gap: 24px;
    margin-top: 12px;
  }
  .stat-box {
    text-align: center;
    background: #fff;
    border: 1px solid #ebebeb;
    border-radius: 8px;
    padding: 12px 20px;
  }
  .stat-box .num {
    font-family: 'Montserrat', Arial, sans-serif;
    font-weight: 800;
    font-size: 24px;
    color: #cc0000;
  }
  .stat-box .desc {
    font-size: 11px;
    color: #666;
    margin-top: 2px;
  }
  .footer {
    margin-top: 32px;
    padding-top: 20px;
    border-top: 2px solid #ebebeb;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .firma-bloque {
    text-align: left;
  }
  .firma-linea {
    border-top: 1px solid #ccc;
    width: 200px;
    margin-bottom: 6px;
  }
  .firma-nombre {
    font-family: 'Montserrat', Arial, sans-serif;
    font-weight: 700;
    font-size: 13px;
    color: #111;
  }
  .firma-sub {
    font-size: 11px;
    color: #666;
  }
  .legales {
    font-size: 10px;
    color: #aaa;
    text-align: right;
    max-width: 280px;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 1.5cm; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="logo-circle">${iniciales || "GFI"}</div>
    <div class="header-info">
      <h2>${agencia.nombreAgencia || "Inmobiliaria"}</h2>
      <p><strong>${agencia.nombreCorredor}</strong>${agencia.matriculaCorredor ? ` · Matrícula ${agencia.matriculaCorredor}` : ""}</p>
      ${agencia.telefonoCorredor ? `<p>${agencia.telefonoCorredor}</p>` : ""}
      ${agencia.emailCorredor ? `<p>${agencia.emailCorredor}</p>` : ""}
    </div>
  </div>

  <!-- TÍTULO -->
  <div class="titulo-propuesta">
    <h1>${titulo}</h1>
    <div class="subtitulo">Para: ${propietario.nombre} ${propietario.apellido}</div>
    <div class="fecha-emision">Fecha de emisión: ${fechaHoy()}</div>
  </div>

  <!-- LA PROPIEDAD -->
  <div class="seccion">
    <h3>La Propiedad</h3>
    <div class="grid-2">
      <div class="dato"><span class="label">Dirección</span><span class="valor">${propietario.direccionPropiedad || "—"}</span></div>
      <div class="dato"><span class="label">Barrio / Ciudad</span><span class="valor">${propietario.barrio ? `${propietario.barrio}, ${propietario.ciudad}` : propietario.ciudad || "—"}</span></div>
      <div class="dato"><span class="label">Tipo</span><span class="valor">${inmueble.tipo}</span></div>
      <div class="dato"><span class="label">Ambientes</span><span class="valor">${inmueble.ambientes}</span></div>
      <div class="dato"><span class="label">Superficie</span><span class="valor">${inmueble.superficie > 0 ? `${inmueble.superficie} m²` : "—"}</span></div>
      ${inmueble.piso ? `<div class="dato"><span class="label">Piso / Unidad</span><span class="valor">${inmueble.piso}</span></div>` : ""}
      <div class="dato"><span class="label">Estado</span><span class="valor">${inmueble.estado}</span></div>
      <div class="dato"><span class="label">Antigüedad</span><span class="valor">${inmueble.antiguedad > 0 ? `${inmueble.antiguedad} años` : "A estrenar"}</span></div>
      ${inmueble.expensas > 0 ? `<div class="dato"><span class="label">Expensas</span><span class="valor">$ ${inmueble.expensas.toLocaleString("es-AR")}/mes</span></div>` : ""}
    </div>
    ${
      inmueble.caracteristicas.length > 0
        ? `<div style="margin-top:14px;"><div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Características destacadas</div>${caracteristicasBadges}</div>`
        : ""
    }
  </div>

  <!-- VALUACIÓN -->
  <div class="seccion">
    <h3>Valuación estimada</h3>
    ${
      operacion.valorEstimado > 0
        ? `<div class="valor-principal">${fmtMoneda(operacion.valorEstimado, operacion.moneda)}</div>
           <p class="comparables-note">Valor estimado basado en comparables de la zona y condiciones actuales del mercado.</p>`
        : `<p style="color:#666;">Valor a determinar en tasación presencial.</p>`
    }
  </div>

  <!-- NUESTRA PROPUESTA -->
  <div class="seccion">
    <h3>Nuestra Propuesta</h3>
    <div class="grid-2">
      <div>
        <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Honorarios profesionales</div>
        <div class="honorarios-badge">${operacion.honorariosPct}%</div>
        ${
          operacion.valorEstimado > 0
            ? `<div style="font-size:12px;color:#555;margin-top:4px;">Equivale a ${montoHonorarios}</div>`
            : ""
        }
      </div>
      <div>
        <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Modalidad</div>
        ${
          operacion.exclusiva
            ? `<div class="exclusiva-box"><span class="check">★</span><div><strong style="font-size:13px;">Exclusividad</strong><br><span style="font-size:11px;color:#555;">${operacion.plazoExclusiva} ${operacion.plazoExclusiva === 1 ? "mes" : "meses"} de exclusiva</span></div></div>`
            : `<div style="color:#555;font-size:13px;">Sin exclusividad</div>`
        }
      </div>
    </div>
  </div>

  <!-- PLAN DE DIFUSIÓN -->
  <div class="seccion">
    <h3>Plan de Difusión</h3>
    <ul class="difusion">${difusionItems}</ul>
  </div>

  <!-- POR QUÉ ELEGIRNOS -->
  <div class="seccion">
    <h3>¿Por qué elegirnos?</h3>
    <ul class="ventajas">${ventajasItems}</ul>
    <div class="stats-row">
      <div class="stat-box">
        <div class="num">${agencia.anosExperiencia}+</div>
        <div class="desc">años de experiencia</div>
      </div>
      <div class="stat-box">
        <div class="num">${agencia.propiedadesVendidas}+</div>
        <div class="desc">operaciones concretadas</div>
      </div>
      <div class="stat-box">
        <div class="num">GFI</div>
        <div class="desc">red nacional de corredores</div>
      </div>
    </div>
  </div>

  <!-- CONDICIONES -->
  <div class="seccion">
    <h3>Condiciones</h3>
    <div class="grid-2">
      <div class="dato"><span class="label">Tipo de operación</span><span class="valor">${tituloOperacion(operacion.tipoOperacion)}</span></div>
      <div class="dato"><span class="label">Exclusividad</span><span class="valor">${operacion.exclusiva ? `Sí — ${operacion.plazoExclusiva} ${operacion.plazoExclusiva === 1 ? "mes" : "meses"}` : "No"}</span></div>
      <div class="dato"><span class="label">Honorarios</span><span class="valor">${operacion.honorariosPct}% + IVA</span></div>
      <div class="dato"><span class="label">Forma de cobro</span><span class="valor">Al momento de la firma</span></div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="firma-bloque">
      <div class="firma-linea"></div>
      <div class="firma-nombre">${agencia.nombreCorredor || agencia.nombreAgencia}</div>
      ${agencia.matriculaCorredor ? `<div class="firma-sub">Matrícula: ${agencia.matriculaCorredor}</div>` : ""}
      ${agencia.telefonoCorredor ? `<div class="firma-sub">${agencia.telefonoCorredor}</div>` : ""}
      ${agencia.emailCorredor ? `<div class="firma-sub">${agencia.emailCorredor}</div>` : ""}
    </div>
    <div class="legales">
      Los valores mencionados son estimativos y sujetos a condiciones de mercado. Los honorarios estarán sujetos a IVA según corresponda. Esta propuesta tiene vigencia de 30 días.
    </div>
  </div>

</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.print();
  }, 400);
}

// ─── Shared input styles ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#111",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  boxSizing: "border-box",
  fontFamily: "Inter, sans-serif",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(255,255,255,0.45)",
  display: "block",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const sectionCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: "20px 22px",
  marginBottom: 16,
};

const fieldGroup = (label: string, children: React.ReactNode): React.ReactNode => (
  <div style={{ marginBottom: 14 }}>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

// ─── Preview Component ────────────────────────────────────────────────────────

interface PreviewProps {
  propietario: DatosPropietario;
  inmueble: DatosInmueble;
  operacion: DatosOperacion;
  agencia: DatosAgencia;
}

function PropuestaPreview({ propietario, inmueble, operacion, agencia }: PreviewProps) {
  const iniciales = inicialesAgencia(agencia.nombreAgencia || "GFI");
  const titulo = `Propuesta de ${tituloOperacion(operacion.tipoOperacion)}`;

  const accentStyle: React.CSSProperties = { color: "#cc0000" };
  const secStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderLeft: "4px solid #cc0000",
    borderRadius: 8,
    padding: "16px 18px",
    marginBottom: 14,
  };
  const secTitleStyle: React.CSSProperties = {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 800,
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
    color: "#cc0000",
    marginBottom: 10,
  };

  return (
    <div
      style={{
        background: "#fff",
        color: "#111",
        borderRadius: 12,
        padding: "28px 30px",
        fontFamily: "Inter, sans-serif",
        fontSize: 13,
        lineHeight: 1.6,
        boxShadow: "0 4px 40px rgba(0,0,0,0.4)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          paddingBottom: 18,
          borderBottom: "3px solid #cc0000",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "#cc0000",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 800,
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {iniciales || "GFI"}
        </div>
        <div>
          <div
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              fontSize: 16,
              color: "#111",
            }}
          >
            {agencia.nombreAgencia || "Nombre de la agencia"}
          </div>
          <div style={{ fontSize: 12, color: "#555" }}>
            {agencia.nombreCorredor || "Nombre del corredor"}
            {agencia.matriculaCorredor ? ` · Mat. ${agencia.matriculaCorredor}` : ""}
          </div>
          {agencia.telefonoCorredor && (
            <div style={{ fontSize: 11, color: "#888" }}>{agencia.telefonoCorredor}</div>
          )}
        </div>
      </div>

      {/* Título */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 800,
            fontSize: 22,
            ...accentStyle,
            margin: 0,
          }}
        >
          {titulo}
        </h1>
        <div style={{ fontSize: 14, color: "#333", fontWeight: 600, marginTop: 4 }}>
          Para:{" "}
          {propietario.nombre || propietario.apellido
            ? `${propietario.nombre} ${propietario.apellido}`.trim()
            : "Propietario"}
        </div>
        <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
          Fecha de emisión: {fechaHoy()}
        </div>
      </div>

      {/* La propiedad */}
      <div style={secStyle}>
        <div style={secTitleStyle}>La Propiedad</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px 16px",
            marginBottom: 10,
          }}
        >
          {[
            ["Dirección", propietario.direccionPropiedad || "—"],
            [
              "Barrio / Ciudad",
              propietario.barrio
                ? `${propietario.barrio}, ${propietario.ciudad}`
                : propietario.ciudad || "—",
            ],
            ["Tipo", inmueble.tipo],
            ["Ambientes", String(inmueble.ambientes)],
            ["Superficie", inmueble.superficie > 0 ? `${inmueble.superficie} m²` : "—"],
            ["Estado", inmueble.estado],
          ].map(([lbl, val]) => (
            <div key={lbl}>
              <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase" as const }}>{lbl}</div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{val}</div>
            </div>
          ))}
        </div>
        {inmueble.caracteristicas.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
            {inmueble.caracteristicas.map((c) => (
              <span
                key={c}
                style={{
                  background: "#f3f3f3",
                  border: "1px solid #e0e0e0",
                  borderRadius: 20,
                  padding: "3px 10px",
                  fontSize: 11,
                  color: "#444",
                }}
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Valuación */}
      <div style={secStyle}>
        <div style={secTitleStyle}>Valuación estimada</div>
        {operacion.valorEstimado > 0 ? (
          <>
            <div
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 800,
                fontSize: 24,
                color: "#cc0000",
                margin: "4px 0",
              }}
            >
              {fmtMoneda(operacion.valorEstimado, operacion.moneda)}
            </div>
            <div style={{ fontSize: 11, color: "#777", fontStyle: "italic" }}>
              Basado en comparables de la zona y condiciones del mercado actual.
            </div>
          </>
        ) : (
          <div style={{ color: "#888" }}>Valor a determinar en tasación presencial.</div>
        )}
      </div>

      {/* Nuestra propuesta */}
      <div style={secStyle}>
        <div style={secTitleStyle}>Nuestra Propuesta</div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" as const, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase" as const, marginBottom: 4 }}>
              Honorarios
            </div>
            <div
              style={{
                display: "inline-block",
                background: "#cc0000",
                color: "#fff",
                padding: "5px 16px",
                borderRadius: 20,
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              {operacion.honorariosPct}%
            </div>
          </div>
          {operacion.exclusiva && (
            <div>
              <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase" as const, marginBottom: 4 }}>
                Modalidad
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#fff3f3",
                  border: "1px solid #ffcccc",
                  borderRadius: 8,
                  padding: "5px 12px",
                }}
              >
                <span style={{ color: "#cc0000", fontWeight: 700 }}>★</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Exclusiva {operacion.plazoExclusiva} {operacion.plazoExclusiva === 1 ? "mes" : "meses"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Plan de difusión */}
      {operacion.estrategiaDifusion.length > 0 && (
        <div style={secStyle}>
          <div style={secTitleStyle}>Plan de Difusión</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "4px 12px",
            }}
          >
            {operacion.estrategiaDifusion.map((d) => (
              <div key={d} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#cc0000",
                    color: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </span>
                {d}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Por qué elegirnos */}
      {agencia.ventajasCompetitivas.length > 0 && (
        <div style={secStyle}>
          <div style={secTitleStyle}>¿Por qué elegirnos?</div>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}>
            {agencia.ventajasCompetitivas.map((v, i) => (
              <li key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "#cc0000", fontWeight: 700, flexShrink: 0 }}>›</span>
                {v}
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              [`${agencia.anosExperiencia}+`, "años de experiencia"],
              [`${agencia.propiedadesVendidas}+`, "operaciones"],
              ["GFI", "red nacional"],
            ].map(([num, desc]) => (
              <div
                key={desc}
                style={{
                  textAlign: "center" as const,
                  background: "#fafafa",
                  border: "1px solid #ebebeb",
                  borderRadius: 8,
                  padding: "8px 14px",
                  flex: 1,
                }}
              >
                <div
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 800,
                    fontSize: 18,
                    color: "#cc0000",
                  }}
                >
                  {num}
                </div>
                <div style={{ fontSize: 10, color: "#777" }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Condiciones */}
      <div style={secStyle}>
        <div style={secTitleStyle}>Condiciones</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
          {[
            ["Tipo de operación", tituloOperacion(operacion.tipoOperacion)],
            [
              "Exclusividad",
              operacion.exclusiva
                ? `Sí — ${operacion.plazoExclusiva} ${operacion.plazoExclusiva === 1 ? "mes" : "meses"}`
                : "No",
            ],
            ["Honorarios", `${operacion.honorariosPct}% + IVA`],
            ["Cobro de honorarios", "Al momento de la firma"],
          ].map(([lbl, val]) => (
            <div key={lbl}>
              <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase" as const }}>{lbl}</div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          paddingTop: 16,
          borderTop: "2px solid #ebebeb",
          marginTop: 8,
        }}
      >
        <div>
          <div style={{ borderTop: "1px solid #ccc", width: 180, marginBottom: 6 }} />
          <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12 }}>
            {agencia.nombreCorredor || agencia.nombreAgencia || "—"}
          </div>
          {agencia.matriculaCorredor && (
            <div style={{ fontSize: 11, color: "#666" }}>Mat. {agencia.matriculaCorredor}</div>
          )}
          {agencia.emailCorredor && (
            <div style={{ fontSize: 11, color: "#666" }}>{agencia.emailCorredor}</div>
          )}
        </div>
        <div style={{ fontSize: 10, color: "#bbb", maxWidth: 220, textAlign: "right" as const }}>
          Vigencia 30 días · Sujeto a condiciones de mercado · Honorarios + IVA
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PropuestaComercialPage() {
  const [paso, setPaso] = useState(1);
  const [propietario, setPropietario] = useState<DatosPropietario>(defaultPropietario);
  const [inmueble, setInmueble] = useState<DatosInmueble>(defaultInmueble);
  const [operacion, setOperacion] = useState<DatosOperacion>(defaultOperacion);
  const [agencia, setAgencia] = useState<DatosAgencia>(() => loadAgenciaDefecto());
  const [propuestas, setPropuestas] = useState<Propuesta[]>(() => loadPropuestas());
  const [propuestaSeleccionada, setPropuestaSeleccionada] = useState<string>("");
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" }>({ msg: "", tipo: "ok" });
  const [ventajaInput, setVentajaInput] = useState("");

  const showToast = useCallback((msg: string, tipo: "ok" | "err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast({ msg: "", tipo: "ok" }), 3000);
  }, []);

  const propuestaActual = useMemo<Propuesta>(
    () => ({
      id: genId(),
      propietario,
      inmueble,
      operacion,
      agencia,
      createdAt: new Date().toISOString(),
    }),
    [propietario, inmueble, operacion, agencia]
  );

  // ─ Acciones ─────────────────────────────────────────────────────────────────

  const guardarPropuesta = useCallback(() => {
    const nueva: Propuesta = { ...propuestaActual, id: genId(), createdAt: new Date().toISOString() };
    const updated = [nueva, ...propuestas];
    savePropuestas(updated);
    setPropuestas(updated);
    showToast("Propuesta guardada correctamente");
  }, [propuestaActual, propuestas, showToast]);

  const cargarPropuesta = useCallback(
    (id: string) => {
      const found = propuestas.find((p) => p.id === id);
      if (!found) return;
      setPropietario(found.propietario);
      setInmueble(found.inmueble);
      setOperacion(found.operacion);
      setAgencia(found.agencia);
      setPropuestaSeleccionada(id);
      setPaso(1);
      showToast("Propuesta cargada");
    },
    [propuestas, showToast]
  );

  const duplicarPropuesta = useCallback(
    (id: string) => {
      const found = propuestas.find((p) => p.id === id);
      if (!found) return;
      const copia: Propuesta = { ...found, id: genId(), createdAt: new Date().toISOString() };
      const updated = [copia, ...propuestas];
      savePropuestas(updated);
      setPropuestas(updated);
      showToast("Propuesta duplicada");
    },
    [propuestas, showToast]
  );

  const eliminarPropuesta = useCallback(
    (id: string) => {
      if (!window.confirm("¿Eliminar esta propuesta? Esta acción no se puede deshacer.")) return;
      const updated = propuestas.filter((p) => p.id !== id);
      savePropuestas(updated);
      setPropuestas(updated);
      if (propuestaSeleccionada === id) setPropuestaSeleccionada("");
      showToast("Propuesta eliminada", "err");
    },
    [propuestas, propuestaSeleccionada, showToast]
  );

  const guardarAgenciaDefecto = useCallback(() => {
    saveAgenciaDefecto(agencia);
    showToast("Datos de agencia guardados como predeterminados");
  }, [agencia, showToast]);

  const toggleCaracteristica = useCallback((c: string) => {
    setInmueble((prev) => ({
      ...prev,
      caracteristicas: prev.caracteristicas.includes(c)
        ? prev.caracteristicas.filter((x) => x !== c)
        : [...prev.caracteristicas, c],
    }));
  }, []);

  const toggleDifusion = useCallback((d: string) => {
    setOperacion((prev) => ({
      ...prev,
      estrategiaDifusion: prev.estrategiaDifusion.includes(d)
        ? prev.estrategiaDifusion.filter((x) => x !== d)
        : [...prev.estrategiaDifusion, d],
    }));
  }, []);

  const agregarVentaja = useCallback(() => {
    const v = ventajaInput.trim();
    if (!v) return;
    setAgencia((prev) => ({ ...prev, ventajasCompetitivas: [...prev.ventajasCompetitivas, v] }));
    setVentajaInput("");
  }, [ventajaInput]);

  const eliminarVentaja = useCallback((i: number) => {
    setAgencia((prev) => ({
      ...prev,
      ventajasCompetitivas: prev.ventajasCompetitivas.filter((_, idx) => idx !== i),
    }));
  }, []);

  const nuevaPropuesta = useCallback(() => {
    setPropietario(defaultPropietario());
    setInmueble(defaultInmueble());
    setOperacion(defaultOperacion());
    setAgencia(loadAgenciaDefecto());
    setPropuestaSeleccionada("");
    setPaso(1);
  }, []);

  // ─ Render pasos ─────────────────────────────────────────────────────────────

  const renderPaso1 = () => (
    <div>
      <div style={sectionCardStyle}>
        <div
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            fontSize: 13,
            color: "rgba(255,255,255,0.5)",
            marginBottom: 14,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Datos del propietario
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div>
            {fieldGroup(
              "Nombre",
              <input
                style={inputStyle}
                value={propietario.nombre}
                onChange={(e) => setPropietario((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Juan"
              />
            )}
          </div>
          <div>
            {fieldGroup(
              "Apellido",
              <input
                style={inputStyle}
                value={propietario.apellido}
                onChange={(e) => setPropietario((p) => ({ ...p, apellido: e.target.value }))}
                placeholder="Pérez"
              />
            )}
          </div>
          <div>
            {fieldGroup(
              "Email",
              <input
                style={inputStyle}
                type="email"
                value={propietario.email}
                onChange={(e) => setPropietario((p) => ({ ...p, email: e.target.value }))}
                placeholder="juan@email.com"
              />
            )}
          </div>
          <div>
            {fieldGroup(
              "Teléfono",
              <input
                style={inputStyle}
                value={propietario.telefono}
                onChange={(e) => setPropietario((p) => ({ ...p, telefono: e.target.value }))}
                placeholder="+54 9 11..."
              />
            )}
          </div>
        </div>
        {fieldGroup(
          "Dirección de la propiedad",
          <input
            style={inputStyle}
            value={propietario.direccionPropiedad}
            onChange={(e) => setPropietario((p) => ({ ...p, direccionPropiedad: e.target.value }))}
            placeholder="Av. Corrientes 1234, Piso 5 Dto B"
          />
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div>
            {fieldGroup(
              "Barrio",
              <input
                style={inputStyle}
                value={propietario.barrio}
                onChange={(e) => setPropietario((p) => ({ ...p, barrio: e.target.value }))}
                placeholder="Palermo"
              />
            )}
          </div>
          <div>
            {fieldGroup(
              "Ciudad",
              <input
                style={inputStyle}
                value={propietario.ciudad}
                onChange={(e) => setPropietario((p) => ({ ...p, ciudad: e.target.value }))}
                placeholder="Buenos Aires"
              />
            )}
          </div>
        </div>
      </div>

      <div style={sectionCardStyle}>
        <div
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            fontSize: 13,
            color: "rgba(255,255,255,0.5)",
            marginBottom: 14,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Datos del inmueble
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div>
            {fieldGroup(
              "Tipo de inmueble",
              <select
                style={inputStyle}
                value={inmueble.tipo}
                onChange={(e) => setInmueble((p) => ({ ...p, tipo: e.target.value }))}
              >
                {TIPOS_INMUEBLE.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            {fieldGroup(
              "Ambientes",
              <input
                style={inputStyle}
                type="number"
                min={1}
                max={20}
                value={inmueble.ambientes}
                onChange={(e) =>
                  setInmueble((p) => ({ ...p, ambientes: parseInt(e.target.value, 10) || 1 }))
                }
              />
            )}
          </div>
          <div>
            {fieldGroup(
              "Superficie (m²)",
              <input
                style={inputStyle}
                type="number"
                min={0}
                value={inmueble.superficie || ""}
                onChange={(e) =>
                  setInmueble((p) => ({ ...p, superficie: parseFloat(e.target.value) || 0 }))
                }
                placeholder="60"
              />
            )}
          </div>
          <div>
            {fieldGroup(
              "Piso / Unidad",
              <input
                style={inputStyle}
                value={inmueble.piso}
                onChange={(e) => setInmueble((p) => ({ ...p, piso: e.target.value }))}
                placeholder="5° B"
              />
            )}
          </div>
          <div>
            {fieldGroup(
              "Estado",
              <select
                style={inputStyle}
                value={inmueble.estado}
                onChange={(e) => setInmueble((p) => ({ ...p, estado: e.target.value }))}
              >
                {ESTADOS_INMUEBLE.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            {fieldGroup(
              "Antigüedad (años)",
              <input
                style={inputStyle}
                type="number"
                min={0}
                value={inmueble.antiguedad || ""}
                onChange={(e) =>
                  setInmueble((p) => ({ ...p, antiguedad: parseInt(e.target.value, 10) || 0 }))
                }
                placeholder="0 = a estrenar"
              />
            )}
          </div>
          <div>
            {fieldGroup(
              "Expensas (ARS/mes)",
              <input
                style={inputStyle}
                type="number"
                min={0}
                value={inmueble.expensas || ""}
                onChange={(e) =>
                  setInmueble((p) => ({ ...p, expensas: parseFloat(e.target.value) || 0 }))
                }
                placeholder="0"
              />
            )}
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <label style={labelStyle}>Características y amenities</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CARACTERISTICAS_OPCIONES.map((c) => {
              const sel = inmueble.caracteristicas.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleCaracteristica(c)}
                  style={{
                    background: sel ? "#cc0000" : "rgba(255,255,255,0.06)",
                    color: sel ? "#fff" : "rgba(255,255,255,0.6)",
                    border: sel ? "1px solid #cc0000" : "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 20,
                    padding: "5px 12px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    transition: "all 0.15s",
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPaso2 = () => (
    <div style={sectionCardStyle}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          {fieldGroup(
            "Tipo de operación",
            <div style={{ display: "flex", gap: 8 }}>
              {(["venta", "alquiler", "ambas"] as const).map((op) => (
                <button
                  key={op}
                  onClick={() => setOperacion((p) => ({ ...p, tipoOperacion: op }))}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 8,
                    border:
                      operacion.tipoOperacion === op
                        ? "1px solid #cc0000"
                        : "1px solid rgba(255,255,255,0.12)",
                    background:
                      operacion.tipoOperacion === op ? "rgba(204,0,0,0.15)" : "rgba(255,255,255,0.04)",
                    color: operacion.tipoOperacion === op ? "#fff" : "rgba(255,255,255,0.5)",
                    fontWeight: operacion.tipoOperacion === op ? 700 : 400,
                    cursor: "pointer",
                    fontSize: 13,
                    fontFamily: "Montserrat, sans-serif",
                    textTransform: "capitalize",
                  }}
                >
                  {op === "ambas" ? "Ambas" : op.charAt(0).toUpperCase() + op.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {fieldGroup(
            "Moneda",
            <select
              style={inputStyle}
              value={operacion.moneda}
              onChange={(e) =>
                setOperacion((p) => ({ ...p, moneda: e.target.value as "USD" | "ARS" }))
              }
            >
              <option value="USD">USD (Dólares)</option>
              <option value="ARS">ARS (Pesos)</option>
            </select>
          )}
        </div>

        <div>
          {fieldGroup(
            `Valor estimado (${operacion.moneda})`,
            <input
              style={inputStyle}
              type="number"
              min={0}
              value={operacion.valorEstimado || ""}
              onChange={(e) =>
                setOperacion((p) => ({ ...p, valorEstimado: parseFloat(e.target.value) || 0 }))
              }
              placeholder="0"
            />
          )}
        </div>

        <div>
          {fieldGroup(
            "Honorarios (%)",
            <input
              style={inputStyle}
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={operacion.honorariosPct}
              onChange={(e) =>
                setOperacion((p) => ({ ...p, honorariosPct: parseFloat(e.target.value) || 0 }))
              }
            />
          )}
        </div>

        <div>
          {fieldGroup(
            "Exclusiva",
            <div style={{ display: "flex", gap: 8 }}>
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  onClick={() => setOperacion((p) => ({ ...p, exclusiva: v }))}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 8,
                    border:
                      operacion.exclusiva === v
                        ? "1px solid #cc0000"
                        : "1px solid rgba(255,255,255,0.12)",
                    background:
                      operacion.exclusiva === v ? "rgba(204,0,0,0.15)" : "rgba(255,255,255,0.04)",
                    color: operacion.exclusiva === v ? "#fff" : "rgba(255,255,255,0.5)",
                    fontWeight: operacion.exclusiva === v ? 700 : 400,
                    cursor: "pointer",
                    fontSize: 13,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {v ? "Sí" : "No"}
                </button>
              ))}
            </div>
          )}
        </div>

        {operacion.exclusiva && (
          <div>
            {fieldGroup(
              "Plazo de exclusiva (meses)",
              <input
                style={inputStyle}
                type="number"
                min={1}
                max={24}
                value={operacion.plazoExclusiva}
                onChange={(e) =>
                  setOperacion((p) => ({
                    ...p,
                    plazoExclusiva: parseInt(e.target.value, 10) || 1,
                  }))
                }
              />
            )}
          </div>
        )}
      </div>

      {operacion.valorEstimado > 0 && (
        <div
          style={{
            marginTop: 14,
            background: "rgba(204,0,0,0.08)",
            border: "1px solid rgba(204,0,0,0.2)",
            borderRadius: 8,
            padding: "12px 16px",
          }}
        >
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
            Honorarios estimados
          </div>
          <div
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              fontSize: 20,
              color: "#cc0000",
            }}
          >
            {fmtMoneda(
              Math.round((operacion.valorEstimado * operacion.honorariosPct) / 100),
              operacion.moneda
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderPaso3 = () => (
    <div style={sectionCardStyle}>
      <div
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 700,
          fontSize: 13,
          color: "rgba(255,255,255,0.5)",
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        Seleccionar canales de difusión
      </div>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>
        Elegí los portales y canales que incluirás en la propuesta.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {PORTALES_OPCIONES.map((portal) => {
          const sel = operacion.estrategiaDifusion.includes(portal);
          return (
            <label
              key={portal}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: sel ? "rgba(204,0,0,0.08)" : "rgba(255,255,255,0.03)",
                border: sel ? "1px solid rgba(204,0,0,0.3)" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: "10px 14px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  border: sel ? "none" : "1px solid rgba(255,255,255,0.2)",
                  background: sel ? "#cc0000" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  cursor: "pointer",
                }}
                onClick={() => toggleDifusion(portal)}
              >
                {sel && (
                  <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>
                    ✓
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: sel ? "#fff" : "rgba(255,255,255,0.6)",
                  fontWeight: sel ? 600 : 400,
                  cursor: "pointer",
                }}
                onClick={() => toggleDifusion(portal)}
              >
                {portal}
              </span>
            </label>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 12,
          fontSize: 12,
          color: "rgba(255,255,255,0.35)",
        }}
      >
        {operacion.estrategiaDifusion.length} canal
        {operacion.estrategiaDifusion.length !== 1 ? "es" : ""} seleccionado
        {operacion.estrategiaDifusion.length !== 1 ? "s" : ""}
      </div>
    </div>
  );

  const renderPaso4 = () => (
    <div>
      <div style={sectionCardStyle}>
        <div
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            fontSize: 13,
            color: "rgba(255,255,255,0.5)",
            marginBottom: 14,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Datos de la agencia
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            {fieldGroup(
              "Nombre de la agencia",
              <input
                style={inputStyle}
                value={agencia.nombreAgencia}
                onChange={(e) => setAgencia((p) => ({ ...p, nombreAgencia: e.target.value }))}
                placeholder="Inmobiliaria XYZ"
              />
            )}
          </div>
          <div>
            {fieldGroup(
              "Nombre del corredor",
              <input
                style={inputStyle}
                value={agencia.nombreCorredor}
                onChange={(e) => setAgencia((p) => ({ ...p, nombreCorredor: e.target.value }))}
                placeholder="María García"
              />
            )}
          </div>
          <div>
            {fieldGroup(
              "Matrícula",
              <input
                style={inputStyle}
                value={agencia.matriculaCorredor}
                onChange={(e) => setAgencia((p) => ({ ...p, matriculaCorredor: e.target.value }))}
                placeholder="Nro. 1234"
              />
            )}
          </div>
          <div>
            {fieldGroup(
              "Teléfono del corredor",
              <input
                style={inputStyle}
                value={agencia.telefonoCorredor}
                onChange={(e) => setAgencia((p) => ({ ...p, telefonoCorredor: e.target.value }))}
                placeholder="+54 9 11 1234-5678"
              />
            )}
          </div>
          <div>
            {fieldGroup(
              "Email del corredor",
              <input
                style={inputStyle}
                type="email"
                value={agencia.emailCorredor}
                onChange={(e) => setAgencia((p) => ({ ...p, emailCorredor: e.target.value }))}
                placeholder="corredor@agencia.com"
              />
            )}
          </div>
          <div>
            {fieldGroup(
              "Años de experiencia",
              <input
                style={inputStyle}
                type="number"
                min={0}
                value={agencia.anosExperiencia}
                onChange={(e) =>
                  setAgencia((p) => ({ ...p, anosExperiencia: parseInt(e.target.value, 10) || 0 }))
                }
              />
            )}
          </div>
          <div>
            {fieldGroup(
              "Propiedades vendidas",
              <input
                style={inputStyle}
                type="number"
                min={0}
                value={agencia.propiedadesVendidas}
                onChange={(e) =>
                  setAgencia((p) => ({
                    ...p,
                    propiedadesVendidas: parseInt(e.target.value, 10) || 0,
                  }))
                }
              />
            )}
          </div>
        </div>
      </div>

      <div style={sectionCardStyle}>
        <div
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            fontSize: 13,
            color: "rgba(255,255,255,0.5)",
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Ventajas competitivas
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>
          Estos puntos aparecerán en el bloque "¿Por qué elegirnos?".
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {agencia.ventajasCompetitivas.map((v, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(255,255,255,0.04)",
                borderRadius: 8,
                padding: "8px 12px",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span style={{ color: "#cc0000", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                ›
              </span>
              <span style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{v}</span>
              <button
                onClick={() => eliminarVentaja(i)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.3)",
                  cursor: "pointer",
                  fontSize: 14,
                  padding: "0 4px",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={ventajaInput}
            onChange={(e) => setVentajaInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && agregarVentaja()}
            placeholder="Agregar ventaja..."
          />
          <button
            onClick={agregarVentaja}
            style={{
              background: "#cc0000",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 16px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "Montserrat, sans-serif",
              flexShrink: 0,
            }}
          >
            +
          </button>
        </div>
        <button
          onClick={guardarAgenciaDefecto}
          style={{
            marginTop: 12,
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.5)",
            borderRadius: 8,
            padding: "8px 14px",
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Guardar como datos predeterminados
        </button>
      </div>
    </div>
  );

  // ─ Main render ──────────────────────────────────────────────────────────────

  const PASOS = ["Propiedad", "Operación", "Difusión", "Agencia"];

  return (
    <div
      style={{
        background: "#0a0a0a",
        minHeight: "100vh",
        fontFamily: "Inter, sans-serif",
        color: "#fff",
        padding: "24px 16px 60px",
      }}
    >
      {/* Toast */}
      {toast.msg && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: toast.tipo === "ok" ? "#16a34a" : "#cc0000",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 13,
            zIndex: 9999,
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}
        >
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              fontSize: 24,
              margin: 0,
              color: "#fff",
            }}
          >
            Propuesta Comercial
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: "4px 0 0" }}>
            Generador de propuestas para captación de exclusiva
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          {/* ── Columna izquierda: formulario + guardadas ── */}
          <div>
            {/* Progress bar */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                {PASOS.map((nombre, idx) => {
                  const num = idx + 1;
                  const activo = num === paso;
                  const completo = num < paso;
                  return (
                    <button
                      key={nombre}
                      onClick={() => setPaso(num)}
                      style={{
                        flex: 1,
                        background: activo
                          ? "#cc0000"
                          : completo
                          ? "rgba(204,0,0,0.3)"
                          : "rgba(255,255,255,0.06)",
                        border: activo
                          ? "1px solid #cc0000"
                          : completo
                          ? "1px solid rgba(204,0,0,0.4)"
                          : "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        padding: "8px 4px",
                        cursor: "pointer",
                        color: activo ? "#fff" : completo ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
                        fontSize: 11,
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: activo ? 700 : 500,
                        transition: "all 0.15s",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 16,
                          marginBottom: 2,
                          fontWeight: 800,
                        }}
                      >
                        {completo ? "✓" : num}
                      </div>
                      {nombre}
                    </button>
                  );
                })}
              </div>
              <div
                style={{
                  height: 3,
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${((paso - 1) / (PASOS.length - 1)) * 100}%`,
                    background: "#cc0000",
                    borderRadius: 2,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>

            {/* Contenido del paso */}
            {paso === 1 && renderPaso1()}
            {paso === 2 && renderPaso2()}
            {paso === 3 && renderPaso3()}
            {paso === 4 && renderPaso4()}

            {/* Navegación */}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {paso > 1 && (
                <button
                  onClick={() => setPaso((p) => p - 1)}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.7)",
                    borderRadius: 8,
                    padding: "10px 20px",
                    cursor: "pointer",
                    fontSize: 13,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  ← Anterior
                </button>
              )}
              {paso < PASOS.length ? (
                <button
                  onClick={() => setPaso((p) => p + 1)}
                  style={{
                    flex: 1,
                    background: "#cc0000",
                    border: "none",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "10px 0",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "Montserrat, sans-serif",
                  }}
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  onClick={guardarPropuesta}
                  style={{
                    flex: 1,
                    background: "#cc0000",
                    border: "none",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "10px 0",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "Montserrat, sans-serif",
                  }}
                >
                  Guardar propuesta
                </button>
              )}
            </div>

            {/* Propuestas guardadas */}
            <div
              style={{
                marginTop: 32,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "18px 20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    color: "rgba(255,255,255,0.5)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Propuestas guardadas ({propuestas.length})
                </div>
                <button
                  onClick={nuevaPropuesta}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.5)",
                    borderRadius: 6,
                    padding: "5px 12px",
                    cursor: "pointer",
                    fontSize: 11,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  + Nueva
                </button>
              </div>

              {propuestas.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px 0",
                    color: "rgba(255,255,255,0.2)",
                    fontSize: 13,
                  }}
                >
                  Aún no guardaste ninguna propuesta
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {propuestas.map((p) => {
                    const sel = p.id === propuestaSeleccionada;
                    return (
                      <div
                        key={p.id}
                        style={{
                          background: sel ? "rgba(204,0,0,0.08)" : "rgba(255,255,255,0.03)",
                          border: sel
                            ? "1px solid rgba(204,0,0,0.3)"
                            : "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 8,
                          padding: "10px 12px",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{ flex: 1, cursor: "pointer" }}
                          onClick={() => cargarPropuesta(p.id)}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                            {p.propietario.apellido
                              ? `${p.propietario.apellido}, ${p.propietario.nombre}`
                              : p.propietario.nombre || "Sin nombre"}
                          </div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                            {p.inmueble.tipo} · {p.operacion.tipoOperacion === "ambas" ? "Venta/Alq." : p.operacion.tipoOperacion} ·{" "}
                            {new Date(p.createdAt).toLocaleDateString("es-AR")}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button
                            onClick={() => duplicarPropuesta(p.id)}
                            title="Duplicar"
                            style={{
                              background: "transparent",
                              border: "1px solid rgba(255,255,255,0.1)",
                              color: "rgba(255,255,255,0.4)",
                              borderRadius: 6,
                              padding: "4px 8px",
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            ⊕
                          </button>
                          <button
                            onClick={() => eliminarPropuesta(p.id)}
                            title="Eliminar"
                            style={{
                              background: "transparent",
                              border: "1px solid rgba(204,0,0,0.2)",
                              color: "rgba(204,0,0,0.6)",
                              borderRadius: 6,
                              padding: "4px 8px",
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Columna derecha: preview + acciones ── */}
          <div style={{ position: "sticky", top: 20 }}>
            {/* Acciones */}
            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <button
                onClick={() => generarPDF(propuestaActual)}
                style={{
                  flex: 1,
                  background: "#cc0000",
                  border: "none",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "12px 0",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  fontFamily: "Montserrat, sans-serif",
                }}
              >
                Generar PDF / Imprimir
              </button>
              <button
                onClick={guardarPropuesta}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "12px 0",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Guardar propuesta
              </button>
            </div>

            {/* Preview label */}
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.25)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: 10,
                paddingLeft: 2,
              }}
            >
              Preview en tiempo real
            </div>

            {/* Preview */}
            <div style={{ transform: "scale(0.85)", transformOrigin: "top left", width: "117.6%" }}>
              <PropuestaPreview
                propietario={propietario}
                inmueble={inmueble}
                operacion={operacion}
                agencia={agencia}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
