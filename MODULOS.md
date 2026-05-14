# GFI® — Estado de Módulos (v17 — 139 módulos)

> Referencia: `public/GFI_Maestro_v17.pdf`
> Actualizado automáticamente con cada PR.

## Leyenda
- ✅ Implementado
- 🟡 Parcial
- ❌ Pendiente / Diferido

---

## PLATAFORMA BASE Y COMUNIDAD

| # | Módulo | Estado | Ruta / Notas |
|---|--------|--------|--------------|
| 0 | Dashboard Principal | ✅ | `/dashboard` |
| 1 | Eventos y Agenda | ✅ | `/eventos` + `/agenda` |
| 2 | Motor MIR | ✅ | `/mir` |
| 3 | Cartera de Propiedades | ✅ | `/crm/cartera` |
| 4 | Biblioteca del Corredor | ✅ | `/biblioteca` |
| 5 | Foro / Chat | ✅ | `/foro` |
| 6 | Sistema de Ideas | ✅ | `/ideas` |
| 7 | Tasador Inteligente | ✅ | `/comparables/tasador` |

---

## INTELIGENCIA DE MERCADO

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| 27 | Observatorio del Mercado | 🟡 | Widget dashboard, sin página dedicada |
| 28 | Estadísticas del Mercado | ❌ | Pendiente |
| 29 | Comparables de Venta | ✅ | `/comparables` |
| 30 | Radar de Noticias | 🟡 | `/noticias` |
| 31 | Encuestas de Mercado | ✅ | `/encuestas` |
| 32 | Ranking de Zonas | 🟡 | Widget dashboard |
| 33 | Alertas de Mercado | 🟡 | Integrado en MIR y CRM |
| 34 | Data Warehouse | ❌ | Backend futuro |
| 35 | API Pública de Estadísticas | ❌ | Diferido |
| 36 | Informes Trimestrales | 🟡 | `/reportes` |

---

## CRM Y HERRAMIENTAS COMERCIALES

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| 37 | CRM Inmobiliario | ✅ | `/crm` |
| 38 | Pipeline de Operaciones | ✅ | `/crm/negocios` |
| 39 | Fichas Comerciales | ✅ | `/crm/cartera/ficha/[id]` |
| 39B | **Generador de Post Redes Sociales IA** | ✅ | Botón en ficha — Instagram + WhatsApp — `v18` |
| 40 | Presentaciones Comerciales | ❌ | Pendiente |
| 40B | Integración con Portales | 🟡 | `/crm/portales` |
| 40C | Alianzas entre Corredores | ✅ | `/crm/alianzas` |
| 40D | Web Propia por Corredor | ✅ | `/mi-web` |
| 41 | Cotizaciones | ✅ | `/cotizaciones` |
| 42 | Match de Monedas | ✅ | `/cotizaciones` |
| 43 | Historial de Cotizaciones | ✅ | Integrado |
| 44 | Calculadoras Inmobiliarias | ✅ | `/calculadoras` |
| 45 | Análisis Financiero | 🟡 | Integrado en CRM |

---

## DIRECTORIOS Y SERVICIOS

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| 46 | Directorio de Escribanos | ✅ | `/directorios` |
| 47 | Directorio de Abogados | ✅ | `/directorios` |
| 48 | Directorio de Contadores | ✅ | `/directorios` |
| 49 | Proveedores del Sector | ✅ | `/proveedores` |
| 50 | Marketplace entre Miembros | ✅ | `/marketplace` |
| 51 | Bolsa de Trabajo | 🟡 | Sin página dedicada |
| 52 | Networking Profesional | ✅ | `/networking` |

---

## DESARROLLADORES E INVERSIONES

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| 53 | Base de Datos Desarrolladores | ✅ | `/emprendimientos` |
| 54 | Publicación de Proyectos | ✅ | `/emprendimientos` |
| 55 | Seguimiento de Unidades | ✅ | `/emprendimientos` |

---

## INTELIGENCIA ARTIFICIAL

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| 56 | IA Asistente Chat Flotante | ✅ | `IAChatFlotante.tsx` |
| 57 | Redacción Automatizada | 🟡 | Integrado en fichas |
| 58 | Generador de Descripciones | ✅ | CRM cartera |
| 59 | Analizador de Mercado IA | 🟡 | Widget dashboard |
| 60 | Recomendador de Precios IA | 🟡 | `/comparables/tasador` |
| 61 | Analizador de Demanda IA | 🟡 | Integrado en MIR |
| 62 | Panel de Reportes | 🟡 | `/crm/estadisticas` |
| 63 | Panel Estadístico Admin | ✅ | `/admin` |

---

## EVENTOS Y SPONSORS

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| 66 | Venta de Entradas | ❌ | Pendiente |
| **67** | **Sistema de Sponsors** | ✅ | **Portal `/sponsors/portal/` — dashboard, campañas, beneficios, saldo. Suscripción mensual + cobro por referidos (adhesiones de corredores). Admin gestiona plan, saldo y mensualidad. `v20`** |
| 68 | Publicidad en Plataforma | ✅ | Admin — banners |

---

## LEGAL Y DOCUMENTACIÓN

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| 70 | Documentación Legal Oficial | ✅ | `/legal` |
| 71 | Guías Inmobiliarias | ✅ | `/legal` |
| 108 | Biblioteca de Cláusulas | 🟡 | Integrado en `/legal` |

---

## ADMINISTRACIÓN Y SISTEMA

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| 72 | Panel Administrativo | ✅ | `/admin` |
| 73 | Gestión de Usuarios y Perfiles | ✅ | `/perfil` |
| 74 | Validación Matrícula COCIR | 🟡 | `/padron` — manual en MVP |
| 75 | Control de Acceso y Permisos | ✅ | 4 roles implementados |
| 76 | Suscripciones | ✅ | `/perfil` — email + push al aprobar |
| 77 | Pagos y Membresías | ✅ | Admin verifica manualmente |
| 78 | Período de Gracia | ✅ | 3 días configurados |
| 79 | Logs de Actividad | 🟡 | Backend, sin UI |
| 80 | Seguridad y Backups | 🟡 | 2FA sí |
| 81 | Estadísticas de Uso | 🟡 | Widget admin |
| 82 | Panel Estratégico | 🟡 | Admin |

---

## REPUTACIÓN Y EXPANSIÓN

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| **83** | **Sistema de Insignias/Badges** | ✅ | **`/perfil` — 14 badges en 4 tiers (Bronce/Plata/Oro/Especiales) con progress bars — `v18`** |
| 85 | Integración CRMs Externos | ❌ | Diferido |
| 86 | Integración Sistemas Administración | ❌ | Diferido |
| 87 | Sistema de Franquicias | ❌ | Diferido |
| 88 | Expansión Regional | ❌ | Diferido |
| 89 | Plataforma PropTech Completa | ❌ | Diferido |

---

## MÓDULOS AVANZADOS

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| 90 | App Móvil Nativa | ❌ | Fase siguiente |
| 91 | Recorridas Virtuales 360 | ❌ | Embed externo |
| 92 | Firma Digital | ✅ | `/crm/firma` |
| 93 | Gestión de Honorarios | 🟡 | Integrado en negocios |
| 94 | Portal Vendedor | ❌ | Diferido |
| 95 | Portal Comprador | ❌ | Diferido |
| 96 | Cursos y Capacitación Online | ❌ | Pendiente |
| 98 | Webinars / Clases en Vivo | ✅ | `/canal-educativo` |
| 99 | Garantías de Alquiler | ❌ | Diferido |
| 100 | Seguimiento Post Cierre | ✅ | `/crm/post-cierre` |
| 101 | Encuestas de Satisfacción | ✅ | Post-visita automática |
| 102 | Google Maps / Street View | 🟡 | Integrado en fichas |
| 103 | Reconocimiento de Imágenes IA | ❌ | Diferido |
| 104 | Gestión de Llaves | ✅ | `/crm/llaves` |
| 105 | Valoraciones entre Corredores | ❌ | Pendiente |
| **106** | **Autorizaciones de Venta** | ✅ | **`/crm/autorizaciones` — alertas 30/15/7 días — cron diario — `v18`** |
| 109 | Gestión de Referidos | ✅ | `/referidos` |
| 110 | Código de Ética | ✅ | Aceptación al registro |
| 111 | Denuncias y Moderación | 🟡 | Sin UI visible |
| 112 | Panel de Notificaciones | ✅ | `/notificaciones` |
| 113 | Metas y Objetivos | ✅ | `/crm/metas` |
| 114 | Historial de Actividad | ✅ | `/actividades` |
| 115 | Comunicados COCIR | ✅ | Dashboard + `/noticias` |
| 116 | Agenda del Sector | ✅ | `/agenda` |
| 117 | Foro Técnico | ✅ | `/foro` |
| 118 | Convenios Institucionales | ✅ | Admin |
| 120 | Comunicaciones Masivas | ✅ | Admin — push + mail |

---

## MÓDULOS NUEVOS v13-v17

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| 121 | Repositorio de Enlaces | ✅ | `/enlaces` |
| 122 | COCIR — Marco Normativo | ✅ | `/legal` + `/padron` |
| 123 | Red de Corredores | ✅ | `/padron-gfi` + `/red-gfi` |
| 124 | Gestión de Alquileres | ❌ | Diferido |
| 125 | Administración de Consorcios | ❌ | Diferido |
| 126 | Seguimiento Escrituras | ✅ | `/crm/escrituras` |
| 127 | Gestión de Loteos | ❌ | Diferido |
| 128 | Trámites Catastrales | 🟡 | Links en `/enlaces` |
| 129 | Mail Bidireccional | ✅ | `/crm/emails` |
| 130 | Gestión de Visitas | ✅ | `/crm/visitas` |
| 131 | Mutual GFI | ❌ | Diferido |
| 132 | Ranking/Prioridad Pago | ❌ | Diferido |
| 133 | Lista Negra / Alertas | 🟡 | `/crm/lista-negra` |
| 134 | Modo Silencioso | 🟡 | Campo en perfil, sin UI completa |
| 135 | Seguro Integrado | ❌ | Diferido |
| 136 | Generador de Contratos | ✅ | `/contratos` |
| 137 | Canal Educativo en Vivo | ✅ | `/canal-educativo` |
| 138 | IA Memoria Colectiva del Foro | 🟡 | Resumidor IA integrado |

---

## RESUMEN

| Estado | Cantidad | % |
|--------|----------|---|
| ✅ Implementado | **55** | **40%** |
| 🟡 Parcial | 18 | 13% |
| ❌ Pendiente/Diferido | 66 | 47% |
| **Total** | **139** | |

---

## PRÓXIMOS A IMPLEMENTAR (alta prioridad)

- [ ] MOD 28 — Estadísticas del mercado (página dedicada)
- [ ] MOD 40 — Presentaciones comerciales (PDF/PPT con datos CRM)
- [ ] MOD 51 — Bolsa de Trabajo (página dedicada)
- [ ] MOD 66 — Venta de entradas a eventos
- [ ] MOD 93 — Gestión de Honorarios (página dedicada)
- [ ] MOD 96 — Cursos y Capacitación Online
- [ ] MOD 105 — Valoraciones entre Corredores
- [ ] MOD 111 — Denuncias y Moderación (UI para usuarios)
- [ ] MOD 138 — IA Memoria Colectiva (base de conocimiento buscable)

---

*Última actualización: v20 — MOD 67 (Portal de Sponsors completo: suscripción mensual configurable por proveedor, cobro por referidos/adhesiones de corredores, sistema de campañas y beneficios, links de referido con tracking de clics, admin gestiona plan/saldo/mensualidad)*
