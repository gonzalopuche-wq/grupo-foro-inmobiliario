import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad — GFI® Grupo Foro Inmobiliario",
  description: "Política de privacidad de la plataforma y la app GFI® Grupo Foro Inmobiliario.",
};

// Página pública (sin login) — requerida por Google Play y las tiendas de apps.
export default function PrivacidadPage() {
  const actualizado = "Junio 2026";
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "48px 20px 80px", fontFamily: "var(--font-body)", color: "var(--gfi-text-primary)", lineHeight: 1.7 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Política de Privacidad</h1>
      <p style={{ color: "var(--gfi-text-secondary)", fontSize: 13, marginBottom: 28 }}>
        GFI® — Grupo Foro Inmobiliario · Última actualización: {actualizado}
      </p>

      <Section titulo="1. Quiénes somos">
        GFI® (Grupo Foro Inmobiliario) es una plataforma profesional para corredores inmobiliarios matriculados.
        Esta política describe qué datos tratamos y cómo, tanto en el sitio web como en la aplicación móvil
        (Google Play). Responsable del tratamiento: GFI® — Grupo Foro Inmobiliario, Rosario, Santa Fe, Argentina.
        Contacto: <a href="mailto:foroinmobiliariomatriculados@gmail.com" style={{ color: "var(--gfi-ocean-text)" }}>foroinmobiliariomatriculados@gmail.com</a>.
      </Section>

      <Section titulo="2. Qué datos recopilamos">
        <ul style={ulStyle}>
          <li><strong>Datos de cuenta:</strong> nombre, apellido, email, matrícula, teléfono y datos profesionales que el usuario provee al registrarse.</li>
          <li><strong>Contenido del usuario:</strong> propiedades, contactos, mensajes en foro/comunidad, noticias y archivos que el usuario carga.</li>
          <li><strong>Datos de uso:</strong> información técnica necesaria para el funcionamiento (sesión, dispositivo) y métricas agregadas de uso.</li>
        </ul>
        No recopilamos datos de geolocalización precisa en segundo plano ni accedemos a contactos del dispositivo.
      </Section>

      <Section titulo="3. Para qué los usamos">
        <ul style={ulStyle}>
          <li>Prestar el servicio: autenticación, CRM, cartera de propiedades, red colaborativa (MIR), foro y eventos.</li>
          <li>Gestionar la suscripción y emitir comprobantes de pago.</li>
          <li>Enviar notificaciones operativas relacionadas con la cuenta.</li>
          <li>Mejorar y mantener la seguridad de la plataforma.</li>
        </ul>
      </Section>

      <Section titulo="4. Dónde se almacenan">
        Los datos se almacenan de forma segura en <strong>Supabase</strong> (infraestructura sobre servicios cloud) con
        cifrado en tránsito (HTTPS/TLS) y control de acceso por usuario (Row Level Security). El acceso está restringido
        a la cuenta del propio usuario y a los administradores de la plataforma cuando es necesario para la operación.
      </Section>

      <Section titulo="5. Con quién se comparten">
        No vendemos ni alquilamos datos personales. Solo se comparten con proveedores que hacen posible el servicio
        (alojamiento, base de datos, envío de emails y, en su caso, organismos fiscales para la facturación), y
        únicamente en la medida necesaria. Podemos divulgar información si la ley lo exige.
      </Section>

      <Section titulo="6. Tus derechos">
        De acuerdo con la Ley 25.326 de Protección de Datos Personales (Argentina), podés acceder, rectificar,
        actualizar o solicitar la eliminación de tus datos escribiendo a
        {" "}<a href="mailto:foroinmobiliariomatriculados@gmail.com" style={{ color: "var(--gfi-ocean-text)" }}>foroinmobiliariomatriculados@gmail.com</a>.
        Podés eliminar tu cuenta y los datos asociados solicitándolo por ese medio.
      </Section>

      <Section titulo="7. Retención">
        Conservamos los datos mientras la cuenta esté activa y durante el plazo que exijan obligaciones legales
        o fiscales. Luego se eliminan o anonimizan.
      </Section>

      <Section titulo="8. Menores">
        El servicio está dirigido a profesionales inmobiliarios mayores de 18 años. No está dirigido a menores.
      </Section>

      <Section titulo="9. Cambios">
        Podemos actualizar esta política. Publicaremos la versión vigente en esta misma página con su fecha de
        actualización.
      </Section>

      <p style={{ marginTop: 32, fontSize: 13, color: "var(--gfi-text-muted)" }}>
        Para consultas sobre privacidad: foroinmobiliariomatriculados@gmail.com
      </p>
    </main>
  );
}

const ulStyle: React.CSSProperties = { margin: "8px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 };

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{titulo}</h2>
      <div style={{ fontSize: 14, color: "var(--gfi-text-secondary)" }}>{children}</div>
    </section>
  );
}
