# GFI® — Estado de Módulos (v29 — 139 módulos)

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
| **2** | **Motor MIR** | ✅ | **`/mir` — Smart Prospecting push implementado; parser WA→MIR activo. PEDIDO URGENTE: badge ⚡ amarillo, 48hs de vigencia, checkbox en formulario. Migration 051.** |
| **3** | **Cartera de Propiedades** | 🟡 | **`/crm/cartera` — Pendiente: parser IA directo desde WA (activo vía webhook), DIFUSIONES, CONTACTOS SUGERIDOS, import/export Excel** |
| 4 | Biblioteca del Corredor | ✅ | `/biblioteca` |
| **5** | **Foro / Chat** | 🟡 | **`/foro` — Grupos WA dinámicos desde DB. Webhook WhatsApp Business API activo. Pendiente: vinculación bidireccional grupos, migración historial** |
| 6 | Sistema de Ideas | ✅ | `/ideas` |
| 7 | Tasador Inteligente | ✅ | `/comparables/tasador` |

---

## INTELIGENCIA DE MERCADO

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| **27** | **Observatorio del Mercado** | ✅ | **`/observatorio` — datos anonimizados de toda la comunidad GFI®: precio m² por barrio, actividad por zona, tipo de inmueble, MIR oferta vs demanda, KPIs comunidad — `v26`** |
| **28** | **Estadísticas del Mercado** | ✅ | **`/estadisticas-mercado` — KPIs CRM personales, negocios por etapa/mes, cartera por tipo/zona, honorarios proyectados/realizados/cobrados — `v23`** |
| 29 | Comparables de Venta | ✅ | `/comparables` |
| **30** | **Radar de Noticias** | ✅ | **`/noticias` — listado con filtros, destacados, envío por corredor, aprobación admin — `v28`** |
| 31 | Encuestas de Mercado | ✅ | `/encuestas` |
| **32** | **Ranking de Zonas** | ✅ | **`/observatorio` — tabla de barrios por operaciones, precio promedio y precio m² — `v28`** |
| **33** | **Alertas de Mercado** | ✅ | **`/alertas-mercado` — matches MIR personales, actividad por zona, zonas seguidas configurables — `v28`** |
| 34 | Data Warehouse | ❌ | Backend futuro |
| 35 | API Pública de Estadísticas | ❌ | Diferido |
| **36** | **Informes Trimestrales** | ✅ | **`/reportes` — KPIs por período (mes/trimestre/año), comisiones, actividad mensual, zonas, productividad — `v28`** |

---

## CRM Y HERRAMIENTAS COMERCIALES

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| 37 | CRM Inmobiliario | ✅ | `/crm` |
| 38 | Pipeline de Operaciones | ✅ | `/crm/negocios` |
| 39 | Fichas Comerciales | ✅ | `/crm/cartera/ficha/[id]` |
| 39B | **Generador de Post Redes Sociales IA** | ✅ | Botón en ficha — Instagram + WhatsApp — `v18` |
| **40** | **Presentaciones Comerciales** | ✅ | **`/crm/presentaciones` — selección de propiedades, link público /p/[token], vistas, mensaje personalizado, vencimiento — `v22`** |
| 40B | Integración con Portales | 🟡 | `/crm/portales` |
| 40C | Alianzas entre Corredores | ✅ | `/crm/alianzas` |
| 40D | Web Propia por Corredor | ✅ | `/mi-web` |
| 41 | Cotizaciones | ✅ | `/cotizaciones` |
| 42 | Match de Monedas | ✅ | `/cotizaciones` |
| 43 | Historial de Cotizaciones | ✅ | Integrado |
| 44 | Calculadoras Inmobiliarias | ✅ | `/calculadoras` |
| **45** | **Análisis Financiero** | ✅ | **`/crm/negocios` + `/reportes` — honorarios_pct por negocio, comisiones proyectadas/cobradas — `v28`** |

---

## DIRECTORIOS Y SERVICIOS

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| 46 | Directorio de Escribanos | ✅ | `/directorios` |
| 47 | Directorio de Abogados | ✅ | `/directorios` |
| 48 | Directorio de Contadores | ✅ | `/directorios` |
| 49 | Proveedores del Sector | ✅ | `/proveedores` |
| 50 | Marketplace entre Miembros | ✅ | `/marketplace` |
| **51** | **Bolsa de Trabajo** | ✅ | **`/bolsa-trabajo` — ofertas y búsquedas laborales, filtros, contacto directo — `v22`** |
| 52 | Networking Profesional | ✅ | `/networking` |

---

## DESARROLLADORES E INVERSIONES

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| **53** | **Base de Datos Desarrolladores** | ✅ | **`/emprendimientos` — marketplace bidireccional: constructoras suben proyectos (tipo=constructora), corredores GFI los ven y venden unidades. Comisión pactada por proyecto. Migration 054. — `v28`** |
| **54** | **Publicación de Proyectos** | ✅ | **`/emprendimientos` — constructoras publican en marketplace, corredores ven todo con comisión, filtros, búsqueda, contacto directo — `v28`** |
| **55** | **Seguimiento de Unidades** | ✅ | **`/emprendimientos` — unidades disponibles/total por proyecto, amenities, dormitorios, superficies — `v28`** |

---

## INTELIGENCIA ARTIFICIAL

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| 56 | IA Asistente Chat Flotante | ✅ | `IAChatFlotante.tsx` |
| **57** | **Redacción Automatizada** | ✅ | **`/api/ia-descripcion` en CRM cartera — tono configurable, genera descripción completa — `v28`** |
| 58 | Generador de Descripciones | ✅ | CRM cartera |
| **59** | **Analizador de Mercado IA** | ✅ | **`/observatorio` — análisis de datos anonimizados de la comunidad con KPIs y gráficos — `v28`** |
| **60** | **Recomendador de Precios IA** | ✅ | **`/comparables/tasador` — tasación IA basada en comparables, precio recomendado, rango y análisis — `v28`** |
| **61** | **Analizador de Demanda IA** | ✅ | **`/mir` + `/api/ia-matching` — análisis de matches MIR, demanda por zona y tipo — `v28`** |
| **62** | **Panel de Reportes** | ✅ | **`/crm/estadisticas` — propiedades por estado/tipo/operación, leads, visitas, por agente — `v28`** |
| 63 | Panel Estadístico Admin | ✅ | `/admin` |

---

## EVENTOS Y SPONSORS

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| 66 | Venta de Entradas | ❌ | Diferido |
| **67** | **Sistema de Sponsors** | ✅ | **Portal `/sponsors/portal/` — dashboard, campañas, beneficios, saldo. Suscripción mensual + cobro por referidos (adhesiones de corredores). Admin gestiona plan, saldo y mensualidad. `v20`** |
| 68 | Publicidad en Plataforma | ✅ | Admin — banners |

---

## LEGAL Y DOCUMENTACIÓN

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| 70 | Documentación Legal Oficial | ✅ | `/legal` |
| 71 | Guías Inmobiliarias | ✅ | `/legal` |
| **108** | **Biblioteca de Cláusulas** | ✅ | **`/legal` — guías y documentación con cláusulas modelo de captación, exclusividad, contratos — `v28`** |

---

## ADMINISTRACIÓN Y SISTEMA

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| 72 | Panel Administrativo | ✅ | `/admin` |
| 73 | Gestión de Usuarios y Perfiles | ✅ | `/perfil` |
| **74** | **Validación Matrícula COCIR** | ✅ | **`/padron` — sync nocturno: compara matrículas GFI vs padrón COCIR scraped, actualiza `cocir_estado` (activo/suspendido/no_encontrado) — `v22`** |
| 75 | Control de Acceso y Permisos | ✅ | 4 roles implementados |
| **76** | **MI ABONO INTELIGENTE** | ✅ | **`/perfil` (tab Suscripción) — bonificaciones por colaboración: biblioteca, foro, comparables, seniority, referidos. Descuento real en USD calculado mes a mes. Migration 051.** |
| 77 | Pagos y Membresías | ✅ | Admin verifica manualmente |
| 78 | Período de Gracia | ✅ | 3 días configurados |
| **79** | **Logs de Actividad** | ✅ | **`/admin` — tabla `logs_actividad`, UI en admin con filtros por módulo y búsqueda. Migration 055. — `v28`** |
| **80** | **Seguridad y Backups** | ✅ | **2FA TOTP obligatorio para corredores: `/configurar-2fa`, QR code, Supabase MFA, badge en perfil — `v22`** |
| **81** | **Estadísticas de Uso** | ✅ | **`/admin` — KPIs: logins, nuevos corredores, suscripciones activas, ingresos del mes — `v28`** |
| **82** | **Panel Estratégico** | ✅ | **`/admin` — KPIs estratégicos: corredores, MIR, negocios, ingresos, top barrios — `v28`** |

---

## REPUTACIÓN Y EXPANSIÓN

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| **83** | **Sistema de Insignias/Badges** | ✅ | **`/perfil` — 14 badges en 4 tiers (Bronce/Plata/Oro/Especiales) con progress bars — `v18`** |
| **85** | **Integración CRMs Externos** | ✅ | **`/crm/integraciones` — Tokko Broker + Kiteprop (sync propiedades/contactos, base_url configurable), import CSV/Excel, export Excel — `v25`** |
| **86** | **Integración Sistemas Administración** | ✅ | **`/crm/integraciones` — Export contactos/cartera/negocios para contabilidad, historial de operaciones — `v24`** |
| 87 | Sistema de Franquicias | ❌ | Diferido |
| 88 | Expansión Regional | ❌ | Diferido |
| 89 | Plataforma PropTech Completa | ❌ | Diferido |

---

## MÓDULOS AVANZADOS

| # | Módulo | Estado | Notas |
|---|--------|--------|-------|
| 90 | App Móvil Nativa | ❌ | Fase siguiente |
| **91** | **Recorridas Virtuales 360** | ✅ | **`/crm/cartera/ficha/[id]` + web pública — campo `tour_virtual_url` en cartera_propiedades, embed iframe en ficha y web. Matterport/Kuula/iStaging/Roundme. Migration 056. — `v29`** |
| 92 | Firma Digital | ✅ | `/crm/firma` |
| 93 | Gestión de Honorarios | ❌ | Diferido |
| **94** | **Portal Vendedor** | ✅ | **`/crm/portal-vendedor` + `/vendor/[token]` (público) — corredor crea portales por vendedor, link seguro, estado/etapa de la operación con barra de progreso, novedades (nota/visita/oferta/escritura), datos del corredor. Migration 053. — `v27`** |
| 95 | Portal Comprador | ❌ | Diferido |
| **96** | **Cursos y Capacitación Online** | ✅ | **`/cursos` — listado con filtros, inscripción, progreso, admin crea/destaca cursos — `v23`** |
| 98 | Webinars / Clases en Vivo | ✅ | `/canal-educativo` |
| 99 | Garantías de Alquiler | ❌ | Diferido |
| 100 | Seguimiento Post Cierre | ✅ | `/crm/post-cierre` |
| 101 | Encuestas de Satisfacción | ✅ | Post-visita automática |
| **102** | **Google Maps / Street View** | ✅ | **`/crm/cartera/ficha/[id]` — mapa embed de Google Maps por dirección + Street View — `v28`** |
| 103 | Reconocimiento de Imágenes IA | ❌ | Diferido |
| 104 | Gestión de Llaves | ✅ | `/crm/llaves` |
| 105 | Valoraciones entre Corredores | ❌ | Diferido |
| **106** | **Autorizaciones de Venta** | ✅ | **`/crm/autorizaciones` — alertas 30/15/7 días — cron diario — `v18`** |
| 109 | Gestión de Referidos | ✅ | `/referidos` |
| 110 | Código de Ética | ✅ | Aceptación al registro |
| **111** | **Denuncias y Moderación** | ✅ | **`/moderacion` (admin) + `DenunciaModal` integrado en foro — estados, resolución, acción tomada — `v23`** |
| 112 | Panel de Notificaciones | ✅ | `/notificaciones` |
| 113 | Metas y Objetivos | ✅ | `/crm/metas` |
| 114 | Historial de Actividad | ✅ | `/actividades` |
| 115 | Comunicados COCIR | ✅ | Dashboard + `/noticias` |
| **116** | **Agenda del Sector** | ✅ | **`/agenda` — citas, integración Google Calendar, exportación .ics (compatible Outlook/Apple Calendar) — `v25`** |
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
| 128 | Trámites Catastrales | ✅ | Links en `/enlaces` (categoría "Trámites y Portales") |
| 129 | Mail Bidireccional | ✅ | `/crm/emails` |
| 130 | Gestión de Visitas | ✅ | `/crm/visitas` |
| 131 | Mutual GFI | ❌ | Diferido |
| **132** | **Ranking/Prioridad Pago** | ✅ | **`/admin` — sección de ranking de suscripciones: KPIs, filtros por estado, alerta <15d vencimiento, tabla completa — `v28`** |
| 133 | Lista Negra / Alertas | ❌ | Descartado |
| **134** | **Modo Silencioso** | ✅ | **`/perfil` — toggle con datetime picker "silencioso hasta" ya implementado — `v28`** |
| 135 | Seguro Integrado | ❌ | Diferido |
| 136 | Generador de Contratos | ✅ | `/contratos` |
| 137 | Canal Educativo en Vivo | ✅ | `/canal-educativo` |
| **138** | **IA Memoria Colectiva del Foro** | ✅ | **`/foro/memoria` — chat IA que busca con FTS (tsvector) en topics y replies del foro, sintetiza el conocimiento colectivo, cita fuentes — `v22`** |

---

## RESUMEN

| Estado | Cantidad | % |
|--------|----------|---|
| ✅ Implementado | **88** | **63%** |
| 🟡 Parcial | 0 | 0% |
| ❌ Pendiente/Diferido | 51 | 37% |
| **Total** | **139** | |

---

## PRÓXIMOS A IMPLEMENTAR (alta prioridad)

- [x] MOD 27 — Observatorio del Mercado ✅ v26
- [ ] MOD 94 — Portal Vendedor (Diferido — v24)
- [ ] MOD 131 — Mutual GFI (Diferido)
- [ ] MOD 132 — Ranking/Prioridad de Pago

---

*Última actualización: v28 — 88/139 módulos implementados (63%). MODs 132, 53-55, 79, 81-82, 33, 32 implementados. MODs 30, 36, 45, 57, 59-62, 102, 108, 128, 134 verificados y marcados ✅. MOD 133 descartado.*
