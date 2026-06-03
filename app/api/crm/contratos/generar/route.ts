import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function esc(s: string | null | undefined) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtFechaLarga(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

function fmtMonto(n: number, moneda: string): string {
  if (moneda === "USD") return `Dólares estadounidenses ${n.toLocaleString("es-AR")} (USD ${n.toLocaleString("es-AR")})`;
  return `Pesos argentinos ${n.toLocaleString("es-AR")} ($ ${n.toLocaleString("es-AR")})`;
}

interface ContratoData {
  tipo: string;
  propietario_nombre: string;
  propietario_dni?: string;
  propietario_domicilio?: string;
  inquilino_nombre: string;
  inquilino_dni?: string;
  inquilino_domicilio?: string;
  direccion: string;
  barrio?: string;
  tipo_propiedad?: string;
  fecha_inicio: string;
  fecha_fin?: string;
  alquiler_inicial: number;
  moneda: string;
  indice_ajuste?: string;
  periodo_ajuste_meses?: number;
  deposito_meses?: number;
  clausulas_especiales?: string;
  agencia_nombre?: string;
}

function generarHtmlContrato(datos: ContratoData): string {
  const esTipoAlquiler = datos.tipo !== "venta";
  const tipoLabel = datos.tipo === "alquiler" ? "LOCACIÓN DE INMUEBLE" :
                    datos.tipo === "venta" ? "COMPRAVENTA DE INMUEBLE" :
                    "LOCACIÓN TEMPORAL DE INMUEBLE";
  const parteA = datos.tipo === "venta" ? "VENDEDOR" : "LOCADOR";
  const parteB = datos.tipo === "venta" ? "COMPRADOR" : "LOCATARIO";

  const duracionMeses = datos.fecha_fin
    ? Math.round((new Date(datos.fecha_fin).getTime() - new Date(datos.fecha_inicio).getTime()) / (1000 * 60 * 60 * 24 * 30))
    : 24;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Contrato de ${tipoLabel}</title>
<style>
  @media print {
    @page { margin: 2.5cm 2cm; size: A4; }
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; }
  }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    line-height: 1.7;
    color: #1a1a1a;
    background: #fff;
    margin: 0 auto;
    padding: 40px 48px;
    max-width: 900px;
  }
  .encabezado {
    text-align: center;
    border-bottom: 2px solid #1a1a1a;
    padding-bottom: 18px;
    margin-bottom: 30px;
  }
  .encabezado h1 {
    font-size: 16pt;
    font-weight: bold;
    letter-spacing: 2px;
    margin: 0 0 6px;
    text-transform: uppercase;
  }
  .encabezado .subtitulo { font-size: 10pt; color: #555; }
  .seccion { margin-bottom: 24px; }
  .seccion h2 {
    font-size: 12pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid #ccc;
    padding-bottom: 4px;
    margin-bottom: 12px;
  }
  p { margin: 0 0 10px; text-align: justify; }
  .clausula { margin-bottom: 14px; text-align: justify; }
  .clausula strong { font-weight: bold; }
  .firma-section {
    margin-top: 60px;
    display: flex;
    justify-content: space-between;
    gap: 40px;
  }
  .firma-box { flex: 1; text-align: center; }
  .firma-linea {
    border-top: 1px solid #333;
    margin-top: 60px;
    padding-top: 8px;
    font-size: 10pt;
  }
  .sello {
    text-align: center;
    margin-top: 40px;
    border: 1px dashed #aaa;
    padding: 20px;
    font-size: 10pt;
    color: #666;
  }
  .highlight {
    background: #f9f9f9;
    padding: 10px 14px;
    border-left: 3px solid #555;
    margin-bottom: 10px;
  }
</style>
</head>
<body>

<div class="encabezado">
  <h1>Contrato de ${esc(tipoLabel)}</h1>
  <div class="subtitulo">Ciudad Autónoma de Buenos Aires — ${esc(fmtFechaLarga(datos.fecha_inicio))}</div>
  ${datos.agencia_nombre ? `<div class="subtitulo" style="margin-top:4px;font-weight:bold;">${esc(datos.agencia_nombre)}</div>` : ""}
</div>

<div class="seccion">
  <h2>Partes Intervinientes</h2>
  <div class="clausula">
    <strong>${parteA}:</strong> ${esc(datos.propietario_nombre)}${datos.propietario_dni ? `, D.N.I. N° ${esc(datos.propietario_dni)}` : ""}${datos.propietario_domicilio ? `, con domicilio en ${esc(datos.propietario_domicilio)}` : ""}, en adelante denominado/a "<strong>${parteA}</strong>".
  </div>
  <div class="clausula">
    <strong>${parteB}:</strong> ${esc(datos.inquilino_nombre)}${datos.inquilino_dni ? `, D.N.I. N° ${esc(datos.inquilino_dni)}` : ""}${datos.inquilino_domicilio ? `, con domicilio en ${esc(datos.inquilino_domicilio)}` : ""}, en adelante denominado/a "<strong>${parteB}</strong>".
  </div>
</div>

<div class="seccion">
  <h2>Objeto del Contrato</h2>
  <div class="clausula">
    ${esTipoAlquiler
      ? `El ${parteA} da en ${datos.tipo === "alquiler" ? "locación" : "locación temporal"} al ${parteB}, quien acepta, el inmueble ubicado en <strong>${esc(datos.direccion)}${datos.barrio ? ", " + esc(datos.barrio) : ""}</strong>${datos.tipo_propiedad ? ", del tipo <strong>" + esc(datos.tipo_propiedad) + "</strong>" : ""}, Ciudad Autónoma de Buenos Aires, Argentina. El inmueble se destina exclusivamente a uso habitacional, quedando expresamente prohibida la sublocación total o parcial sin previa autorización escrita del ${parteA}.`
      : `El ${parteA} vende al ${parteB}, quien compra y acepta, el inmueble ubicado en <strong>${esc(datos.direccion)}${datos.barrio ? ", " + esc(datos.barrio) : ""}</strong>${datos.tipo_propiedad ? ", del tipo <strong>" + esc(datos.tipo_propiedad) + "</strong>" : ""}, Ciudad Autónoma de Buenos Aires, Argentina, libre de todo gravamen, deuda o restricción a la libre disponibilidad, salvo las que se expresen en el presente.`
    }
  </div>
</div>

<div class="seccion">
  <h2>${esTipoAlquiler ? "Plazo de la Locación" : "Precio y Forma de Pago"}</h2>
  ${esTipoAlquiler
    ? `<div class="clausula">El presente contrato tendrá una duración de <strong>${duracionMeses} meses</strong>, con inicio el <strong>${esc(fmtFechaLarga(datos.fecha_inicio))}</strong> y vencimiento el <strong>${datos.fecha_fin ? esc(fmtFechaLarga(datos.fecha_fin)) : "—"}</strong>, de conformidad con lo establecido por la Ley N° 27.551 de Locaciones Urbanas y sus modificatorias.</div>
      <div class="clausula">Vencido el plazo contractual, si ninguna de las partes manifestare fehacientemente su voluntad de no continuar con una anticipación mínima de 90 días, el contrato se considerará prorrogado automáticamente.</div>`
    : `<div class="clausula">El precio total de la operación es de <strong>${esc(fmtMonto(datos.alquiler_inicial, datos.moneda))}</strong>, que el ${parteB} abonará en la forma y plazos que se convengan entre las partes al momento de la firma de la escritura traslativa de dominio.</div>`
  }
</div>

${esTipoAlquiler ? `
<div class="seccion">
  <h2>Canon Locativo y Ajuste</h2>
  <div class="highlight">
    <strong>Alquiler mensual inicial:</strong> ${esc(fmtMonto(datos.alquiler_inicial, datos.moneda))}
  </div>
  <div class="clausula">
    El canon locativo mensual se establece en <strong>${esc(fmtMonto(datos.alquiler_inicial, datos.moneda))}</strong>, pagadero por adelantado entre los días 1 y 5 de cada mes, mediante depósito o transferencia bancaria en la cuenta que indique el ${parteA}. El pago fuera de término devengará un interés punitorio equivalente a la tasa activa del Banco Nación Argentina.
  </div>
  ${datos.indice_ajuste && datos.indice_ajuste !== "fijo"
    ? `<div class="clausula">
        <strong>Ajuste del canon:</strong> El monto del alquiler se ajustará cada <strong>${datos.periodo_ajuste_meses ?? 3} meses</strong> de acuerdo al índice <strong>${esc(datos.indice_ajuste)}</strong>, conforme a los valores oficiales publicados por el Banco Central de la República Argentina (BCRA) o el Instituto Nacional de Estadística y Censos (INDEC), según corresponda al índice pactado. El primer ajuste operará a los ${datos.periodo_ajuste_meses ?? 3} meses de iniciada la locación.
      </div>`
    : `<div class="clausula">El monto del alquiler es <strong>fijo</strong> durante toda la vigencia del contrato, no admitiéndose ajuste por índice alguno.</div>`
  }
</div>

<div class="seccion">
  <h2>Depósito de Garantía</h2>
  <div class="clausula">
    El ${parteB} entrega en concepto de depósito de garantía la suma equivalente a <strong>${datos.deposito_meses ?? 1} mes/meses</strong> de alquiler, como caución por el fiel cumplimiento de las obligaciones emergentes del presente contrato. Dicho importe será devuelto al ${parteB} dentro de los treinta (30) días posteriores a la efectiva restitución del inmueble, previa comprobación del estado del mismo y la cancelación de todos los servicios a su cargo.
  </div>
</div>` : ""}

<div class="seccion">
  <h2>Obligaciones de las Partes</h2>
  <div class="clausula">
    <strong>Obligaciones del ${parteA}:</strong>
    <ol>
      ${esTipoAlquiler
        ? `<li>Entregar el inmueble en buen estado de conservación y habitabilidad al inicio de la locación.</li>
           <li>Garantizar al ${parteB} el uso y goce pacífico del inmueble durante toda la vigencia del contrato.</li>
           <li>Efectuar las reparaciones estructurales o de mantenimiento que no sean atribuibles al uso del locatario.</li>
           <li>Abonar los impuestos y tasas que correspondan a la propiedad, salvo los que por ley o acuerdo sean a cargo del ${parteB}.</li>`
        : `<li>Transferir al ${parteB} el dominio del inmueble libre de todo gravamen y con la documentación en regla.</li>
           <li>Entregar la posesión del inmueble en la fecha y condiciones pactadas.</li>
           <li>Suscribir la escritura traslativa de dominio en la fecha convenida ante el escribano designado.</li>`
      }
    </ol>
  </div>
  <div class="clausula">
    <strong>Obligaciones del ${parteB}:</strong>
    <ol>
      ${esTipoAlquiler
        ? `<li>Abonar puntualmente el canon locativo pactado.</li>
           <li>Usar el inmueble exclusivamente para el destino establecido, conservándolo en buen estado.</li>
           <li>No efectuar modificaciones, refacciones ni mejoras sin previa autorización escrita del ${parteA}.</li>
           <li>Abonar los servicios de electricidad, gas, internet, teléfono y expensas ordinarias a su cargo.</li>
           <li>Restituir el inmueble al vencimiento en el mismo estado en que lo recibió, salvo el desgaste natural por el uso.</li>
           <li>Permitir el acceso del ${parteA} o su representante para inspeccionar el inmueble, previa notificación con 48 horas de anticipación.</li>`
        : `<li>Abonar el precio total pactado en la forma y plazos acordados.</li>
           <li>Concurrir a la firma de la escritura traslativa de dominio en la fecha y lugar convenidos.</li>
           <li>Abonar los gastos de escrituración, sellado e impuestos que le correspondan por ley.</li>`
      }
    </ol>
  </div>
</div>

<div class="seccion">
  <h2>Disposiciones Generales</h2>
  <div class="clausula">
    <strong>Rescisión anticipada:</strong> ${esTipoAlquiler
      ? `Transcurridos los primeros seis (6) meses de vigencia del contrato, el ${parteB} podrá rescindirlo anticipadamente, notificando en forma fehaciente al ${parteA} con una anticipación mínima de noventa (90) días. Si la rescisión operare antes de cumplido el primer año, corresponderá al ${parteB} abonar una indemnización equivalente a un mes y medio (1,5) de alquiler vigente al momento de la rescisión. Si ocurriere con posterioridad al primer año, la indemnización será equivalente a un (1) mes de alquiler vigente, conforme lo establecido por la Ley N° 27.551.`
      : `Cualquiera de las partes podrá rescindir el presente contrato por incumplimiento grave de las obligaciones asumidas, previa intimación fehaciente con un plazo de diez (10) días hábiles para subsanar el incumplimiento. La parte incumplidora responderá por los daños y perjuicios ocasionados.`
    }
  </div>
  <div class="clausula">
    <strong>Legislación aplicable:</strong> El presente contrato se rige por las disposiciones del Código Civil y Comercial de la Nación Argentina${esTipoAlquiler ? ", la Ley N° 27.551 de Locaciones Urbanas y sus modificatorias" : ""}, y las demás normas legales aplicables vigentes.
  </div>
  <div class="clausula">
    <strong>Jurisdicción y competencia:</strong> Para todos los efectos del presente contrato, las partes se someten expresamente a la jurisdicción de los Tribunales Ordinarios de la Ciudad Autónoma de Buenos Aires, renunciando a cualquier otro fuero o jurisdicción que pudiera corresponderles.
  </div>
  <div class="clausula">
    <strong>Domicilios especiales:</strong> A todos los efectos legales y para las notificaciones que correspondieren, las partes constituyen domicilios especiales en los indicados en el encabezamiento del presente instrumento.
  </div>
</div>

${datos.clausulas_especiales?.trim() ? `
<div class="seccion">
  <h2>Cláusulas Especiales y Adicionales</h2>
  <div class="clausula" style="white-space: pre-wrap;">${esc(datos.clausulas_especiales)}</div>
</div>` : ""}

<div class="seccion">
  <h2>Conformidad y Firma</h2>
  <p>Leído íntegramente el presente contrato y hallado conforme por las partes, lo suscriben en dos (2) ejemplares originales de un mismo tenor y a un solo efecto legal, en la Ciudad Autónoma de Buenos Aires, el día <strong>${esc(fmtFechaLarga(datos.fecha_inicio))}</strong>.</p>
</div>

<div class="firma-section">
  <div class="firma-box">
    <div class="firma-linea">
      <strong>${esc(datos.propietario_nombre)}</strong><br>
      ${parteA}
    </div>
  </div>
  <div class="firma-box">
    <div class="firma-linea">
      <strong>${esc(datos.inquilino_nombre)}</strong><br>
      ${parteB}
    </div>
  </div>
</div>

<div class="sello">
  Sello y firma de la inmobiliaria interviniente<br>
  ${datos.agencia_nombre ? esc(datos.agencia_nombre) : "Inmobiliaria"}
</div>

</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      tipo = "alquiler",
      propietario_nombre,
      propietario_dni,
      propietario_domicilio,
      inquilino_nombre,
      inquilino_dni,
      inquilino_domicilio,
      direccion,
      barrio,
      tipo_propiedad,
      fecha_inicio,
      fecha_fin,
      alquiler_inicial,
      moneda = "ARS",
      indice_ajuste = "ICL",
      periodo_ajuste_meses = 3,
      deposito_meses = 1,
      clausulas_especiales,
      inquilino_telefono,
      propietario_telefono,
      guardar = true,
    } = body;

    if (!propietario_nombre || !inquilino_nombre || !direccion || !fecha_inicio || !alquiler_inicial) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }

    const html = generarHtmlContrato({
      tipo,
      propietario_nombre,
      propietario_dni,
      propietario_domicilio,
      inquilino_nombre,
      inquilino_dni,
      inquilino_domicilio,
      direccion,
      barrio,
      tipo_propiedad,
      fecha_inicio,
      fecha_fin,
      alquiler_inicial: Number(alquiler_inicial),
      moneda,
      indice_ajuste,
      periodo_ajuste_meses: Number(periodo_ajuste_meses),
      deposito_meses: Number(deposito_meses),
      clausulas_especiales,
      agencia_nombre: "Grupo Foro Inmobiliario",
    });

    let contratoId: string | null = null;

    if (guardar) {
      const { data: insertData, error: insertErr } = await sb
        .from("crm_contratos")
        .insert({
          perfil_id: user.id,
          inquilino_nombre,
          inquilino_telefono: inquilino_telefono ?? "",
          propietario_nombre,
          propietario_telefono: propietario_telefono ?? "",
          direccion: direccion + (barrio ? `, ${barrio}` : ""),
          barrio: barrio ?? "",
          tipo_propiedad: tipo_propiedad ?? "",
          fecha_inicio,
          fecha_fin: fecha_fin ?? null,
          alquiler_inicial: Number(alquiler_inicial),
          alquiler_actual: Number(alquiler_inicial),
          moneda,
          indice_ajuste,
          periodo_ajuste_meses: Number(periodo_ajuste_meses),
          tasa_ajuste_anual: 0,
          deposito_meses: Number(deposito_meses),
          estado: "vigente",
          honorarios_admin: 5,
          notas: clausulas_especiales ?? "",
          html_contrato: html,
        })
        .select("id")
        .single();

      if (!insertErr && insertData) {
        contratoId = insertData.id;
      }
    }

    return NextResponse.json({ ok: true, html, contratoId });
  } catch (err) {
    console.error("Error generando contrato:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
