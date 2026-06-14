import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Ambiente, Relevamiento, superficieTotal } from '../lib/types';

interface Row {
  id: string;
  titulo: string | null;
  direccion: string | null;
  tipo: string | null;
  operacion: string | null;
  alto_techo: number | null;
  ambientes: Ambiente[] | null;
  descripcion_ia: string | null;
  tono: string | null;
  created_at: string;
}

function rowToRel(r: Row): Relevamiento {
  return {
    id: r.id,
    titulo: r.titulo ?? 'Relevamiento sin título',
    direccion: r.direccion ?? undefined,
    tipo: r.tipo ?? undefined,
    operacion: r.operacion ?? undefined,
    altoTecho: r.alto_techo ?? 2.6,
    ambientes: Array.isArray(r.ambientes) ? r.ambientes : [],
    descripcionIa: r.descripcion_ia ?? undefined,
    tono: r.tono ?? 'profesional',
    createdAt: r.created_at,
  };
}

// Al persistir no guardamos el base64 de las fotos (pesado) ni nada extra:
// solo geometría y metadatos. Las fotos viven en memoria para la sesión de IA.
function ambientesParaDB(ambientes: Ambiente[]) {
  return ambientes.map(({ fotoBase64, ...rest }) => rest);
}

interface Ctx {
  relevamientos: Relevamiento[];
  loading: boolean;
  current: Relevamiento | null;
  refresh: () => Promise<void>;
  crear: () => Promise<Relevamiento | null>;
  abrir: (id: string) => void;
  setCampo: (patch: Partial<Relevamiento>) => void;
  setAmbientes: (ambientes: Ambiente[]) => void;
  guardar: (updated?: Relevamiento) => Promise<void>;
  eliminar: (id: string) => Promise<void>;
}

const RelevamientoContext = createContext<Ctx | null>(null);

export function RelevamientoProvider({ children }: { children: React.ReactNode }) {
  const [relevamientos, setRelevamientos] = useState<Relevamiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<Relevamiento | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('mide_relevamientos')
      .select('id, titulo, direccion, tipo, operacion, alto_techo, ambientes, descripcion_ia, tono, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setRelevamientos((data as Row[]).map(rowToRel));
  }, []);

  useEffect(() => { refresh().finally(() => setLoading(false)); }, [refresh]);

  const crear = useCallback(async (): Promise<Relevamiento | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('mide_relevamientos')
      .insert({ perfil_id: user.id, titulo: 'Nuevo relevamiento', alto_techo: 2.6, ambientes: [] })
      .select('id, titulo, direccion, tipo, operacion, alto_techo, ambientes, descripcion_ia, tono, created_at')
      .single();
    if (error || !data) return null;
    const rel = rowToRel(data as Row);
    setRelevamientos((prev) => [rel, ...prev]);
    setCurrent(rel);
    return rel;
  }, []);

  const abrir = useCallback((id: string) => {
    setCurrent(relevamientos.find((r) => r.id === id) ?? null);
  }, [relevamientos]);

  const setCampo = useCallback((patch: Partial<Relevamiento>) => {
    setCurrent((c) => (c ? { ...c, ...patch } : c));
  }, []);

  const setAmbientes = useCallback((ambientes: Ambiente[]) => {
    setCurrent((c) => (c ? { ...c, ambientes } : c));
  }, []);

  // Persiste el relevamiento. Función async pura (sin efectos dentro de un
  // updater de estado): podés pasarle un objeto `updated` para evitar leer
  // estado obsoleto cuando guardás justo después de un setCampo/setAmbientes.
  const guardar = useCallback(async (updated?: Relevamiento) => {
    const active = updated ?? current;
    if (!active) return;
    if (updated) setCurrent(updated);

    const total = superficieTotal(active.ambientes);
    const { error } = await supabase
      .from('mide_relevamientos')
      .update({
        titulo: active.titulo,
        direccion: active.direccion ?? null,
        tipo: active.tipo ?? null,
        operacion: active.operacion ?? null,
        alto_techo: active.altoTecho,
        ambientes: ambientesParaDB(active.ambientes),
        superficie_total: total,
        descripcion_ia: active.descripcionIa ?? null,
        tono: active.tono ?? 'profesional',
      })
      .eq('id', active.id);
    if (error) throw error;

    setRelevamientos((prev) => prev.map((r) => (r.id === active.id ? active : r)));
  }, [current]);

  const eliminar = useCallback(async (id: string) => {
    await supabase.from('mide_relevamientos').delete().eq('id', id);
    setRelevamientos((prev) => prev.filter((r) => r.id !== id));
    setCurrent((c) => (c?.id === id ? null : c));
  }, []);

  return (
    <RelevamientoContext.Provider
      value={{ relevamientos, loading, current, refresh, crear, abrir, setCampo, setAmbientes, guardar, eliminar }}
    >
      {children}
    </RelevamientoContext.Provider>
  );
}

export function useRelevamientos(): Ctx {
  const ctx = useContext(RelevamientoContext);
  if (!ctx) throw new Error('useRelevamientos debe usarse dentro de RelevamientoProvider');
  return ctx;
}
