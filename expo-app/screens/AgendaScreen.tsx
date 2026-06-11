import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { C, F } from '../lib/theme';

interface Tarea {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: string | null;
  prioridad: string | null;
  estado: string;
  fecha_vencimiento: string | null;
}

const PRIORIDAD_COLOR: Record<string, string> = { alta: C.red, media: C.yellow, baja: C.textMid };

export default function AgendaScreen() {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'pendientes' | 'completadas'>('pendientes');

  const cargar = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setLoading(false); return; }
    let q = supabase
      .from('crm_tareas')
      .select('id, titulo, descripcion, tipo, prioridad, estado, fecha_vencimiento')
      .eq('perfil_id', auth.user.id)
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
      .limit(100);
    q = tab === 'pendientes'
      ? q.in('estado', ['pendiente', 'en_progreso'])
      : q.eq('estado', 'completada');
    const { data } = await q;
    if (data) setTareas(data as unknown as Tarea[]);
  }, [tab]);

  useEffect(() => { setLoading(true); cargar().finally(() => setLoading(false)); }, [cargar]);
  const onRefresh = async () => { setRefreshing(true); await cargar(); setRefreshing(false); };

  const completar = async (id: string) => {
    setTareas(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from('crm_tareas')
      .update({ estado: 'completada', fecha_completada: new Date().toISOString() })
      .eq('id', id);
    if (error) await cargar(); // revertir: vuelve a traer la lista real
  };

  const fechaTxt = (f: string | null) => {
    if (!f) return null;
    const d = new Date(f.includes('T') ? f : `${f}T12:00:00`);
    if (isNaN(d.getTime())) return null;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dd = new Date(d); dd.setHours(0, 0, 0, 0);
    const diff = Math.round((dd.getTime() - hoy.getTime()) / 86400000);
    if (diff < 0) return { txt: `Vencida (${d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })})`, color: C.red };
    if (diff === 0) return { txt: 'Hoy', color: C.yellow };
    if (diff === 1) return { txt: 'Mañana', color: C.green };
    return { txt: d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }), color: C.textMid };
  };

  const renderItem = ({ item }: { item: Tarea }) => {
    const venc = fechaTxt(item.fecha_vencimiento);
    const pColor = PRIORIDAD_COLOR[(item.prioridad ?? '').toLowerCase()] ?? C.textDim;
    const hecha = item.estado === 'completada';
    return (
      <View style={s.card}>
        {!hecha && (
          <TouchableOpacity style={s.check} onPress={() => completar(item.id)}>
            <Text style={s.checkTxt}>○</Text>
          </TouchableOpacity>
        )}
        <View style={s.info}>
          <Text style={[s.titulo, hecha && s.tituloHecha]} numberOfLines={2}>{item.titulo}</Text>
          {item.descripcion && <Text style={s.desc} numberOfLines={2}>{item.descripcion}</Text>}
          <View style={s.metaRow}>
            {!hecha && (
              <View style={[s.prioBadge, { borderColor: pColor }]}>
                <Text style={[s.prioTxt, { color: pColor }]}>{item.prioridad ?? 'media'}</Text>
              </View>
            )}
            {venc && <Text style={[s.venc, { color: venc.color }]}>{venc.txt}</Text>}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={s.root}>
      <View style={s.tabs}>
        {(['pendientes', 'completadas'] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{t === 'pendientes' ? 'Pendientes' : 'Completadas'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.red} />
      ) : (
        <FlatList
          data={tareas}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.red} />}
          ListEmptyComponent={<Text style={s.empty}>{tab === 'pendientes' ? 'No tenés tareas pendientes 🎉' : 'Todavía no completaste tareas.'}</Text>}
          contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 30 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  tabs:       { flexDirection: 'row', padding: 14, gap: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  tab:        { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  tabActive:  { backgroundColor: C.red, borderColor: C.red },
  tabTxt:     { fontFamily: F.bold, fontSize: 13, color: C.textMid },
  tabTxtActive: { color: C.white },
  card:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.bgCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  check:      { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: C.green, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkTxt:   { color: C.green, fontSize: 16, lineHeight: 18 },
  info:       { flex: 1 },
  titulo:     { fontFamily: F.semi, fontSize: 14, color: C.white, lineHeight: 19 },
  tituloHecha:{ textDecorationLine: 'line-through', color: C.textMid },
  desc:       { fontFamily: F.body, fontSize: 12, color: C.textDim, marginTop: 3, lineHeight: 17 },
  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  prioBadge:  { borderWidth: 1, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 1 },
  prioTxt:    { fontFamily: F.bold, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase' },
  venc:       { fontFamily: F.medium, fontSize: 11 },
  empty:      { textAlign: 'center', marginTop: 60, fontFamily: F.body, fontSize: 14, color: C.textDim },
});
