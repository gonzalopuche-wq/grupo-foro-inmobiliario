/**
 * json-render component catalog para el portal de propiedades GFI.
 * Define qué componentes puede usar la AI para generar UI de propiedades.
 * https://github.com/vercel-labs/json-render
 */
import { z } from "zod";

// Esquema de una propiedad que la AI puede renderizar
const PropiedadSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  precio: z.number().nullable(),
  moneda: z.enum(["USD", "ARS"]).default("USD"),
  operacion: z.string(),
  tipo: z.string(),
  ciudad: z.string().optional(),
  zona: z.string().nullable().optional(),
  dormitorios: z.number().nullable().optional(),
  banos: z.number().nullable().optional(),
  superficie_cubierta: z.number().nullable().optional(),
  foto: z.string().url().nullable().optional(),
  destacada: z.boolean().default(false),
  slug: z.string(),  // para construir el href
});

// ── Component definitions (spec que genera la AI) ────────────────────────────

export const propiedadesComponentDefinitions = {
  PropCard: {
    description: "Tarjeta de propiedad individual",
    props: PropiedadSchema,
  },
  PropGrid: {
    description: "Grilla de propiedades (1-3 columnas según cantidad)",
    props: z.object({
      titulo: z.string().optional().describe("Título opcional de la sección"),
      columnas: z.number().min(1).max(3).default(2),
    }),
    children: z.array(z.literal("PropCard")),
  },
  PropDestacada: {
    description: "Propiedad destacada con foto grande y descripción",
    props: PropiedadSchema.extend({
      descripcion: z.string().nullable().optional(),
    }),
  },
  PropResumen: {
    description: "Resumen estadístico del resultado de búsqueda",
    props: z.object({
      total: z.number(),
      ventas: z.number(),
      alquileres: z.number(),
      precio_promedio: z.number().nullable(),
      moneda_promedio: z.enum(["USD", "ARS"]).nullable(),
    }),
  },
  MensajeVacio: {
    description: "Mensaje cuando no hay resultados",
    props: z.object({
      texto: z.string(),
      sugerencia: z.string().optional(),
    }),
  },
} as const;

export type PropCardProps = z.infer<typeof PropiedadSchema>;
export type PropGridProps = { titulo?: string; columnas: number };
export type PropResumenProps = {
  total: number; ventas: number; alquileres: number;
  precio_promedio: number | null; moneda_promedio: "USD" | "ARS" | null;
};
