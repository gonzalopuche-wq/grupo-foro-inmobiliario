<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# MÓDULOS EN STANDBY — NO IMPLEMENTAR

Los siguientes módulos están reservados para una segunda etapa / programa vinculado externo.
**NO los implementes en GFI bajo ningún concepto**, aunque el usuario pida "agregar cosas" o "completar sugerencias".
Si el usuario los menciona, recordarle que están en standby para otro programa.

## Gestión de alquileres / contratos (STANDBY — etapa futura)
- Contratos de alquiler (`crm_contratos`, `contratos-activos`)
- Cobranzas y pagos de alquiler (`crm_pagos_alquiler`, `cobranzas`)
- Portal del inquilino
- Portal del propietario
- Renovación de contratos
- Firma digital de contratos (`firma_solicitudes`, `/firmar/[token]`)
- Comprobantes/recibos de alquiler
- Ajuste de alquiler por índice ICL/IPC (en contexto de gestión, no calculadora)
- Vencimientos de contratos

Las migraciones SQL 097 (`crm_contratos`), 105 (`crm_pagos_alquiler`, `crm_vencimientos_custom`) y 130 (`firma_solicitudes`) existen como archivos pero **NO deben ejecutarse en Supabase** hasta que el usuario lo indique explícitamente.
