import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { C, F } from '../lib/theme';

interface Propiedad {
  id: string;
  titulo: string | null;
  tipo: string | null;
  operacion: string | null;
  precio: number | null;
  moneda: string | null;
  zona: string | null;
  ciudad: string | null;
  ambientes: number | null;
  dormitorios: number | null;
  superficie_total: number | null;
  estado: string | null;
  perfil_nombre?: string;
}

const OPERACION_COLOR: Record<string, string> = {
  venta: '#3b82f6',
  alquiler: '#22c55e',
  ambas: '#8b5cf6',
};

export default function MIRScreen() {
  const [props, setProps] = useState<Propiedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroOp, setFiltroOp] = useState<'todos' | 'venta' | 'alquiler'>('todos');

  const cargar = useCallback(async () => {
    let query = supabase
      .from('cartera_propiedades')
      .select('id, titulo, tipo, operacion, precio, moneda, zona, ciudad, ambientes, dormitorios, superficie_total, estado, perfil_id')
      .neq('estado', 'retirada')
      .order('created_at', { ascending: false })
      .limit(80);

    if (busqueda.length >= 2) {
      query = query.or(`titulo.ilike.%${busqueda}%,zona.ilike.%${busqueda}%,ciudad.ilike.%${busqueda}%,tipo.ilike.%${busqueda}%`);
    }
    if (filtroOp !== 'todos') {
      query = query.or(`operacion.eq.${filtroOp},operacion.eq.ambas`);
    }

    const { data } = await query;
    if (data) setProps(data);
  }, [busqueda, filtroOp]);

  useEffect(() => { setLoading(true); cargar().finally(() => setLoading(false)); }, [cargar]);

  const onRefresh = async () => { setRefreshing(true); await cargar(); setRefreshing(false); };

  const formatPrecio = (precio: number | null, moneda: string | null) => {
    if (!precio) return 'Consultar';
    const m = (moneda ?? 'USD').toUpperCase();
    return m === 'USD'
      ? `USD ${precio.toLocaleString('es-AR')}`
      : `$ ${precio.toLocaleString('es-AR')}`;
  };

  const renderItem = ({ item }: { item: Propiedad }) => {
    const opColor = OPERACION_COLOR[(item.operacion ?? '').toLowerCase()] ?? C.textDim;
    return (
      <TouchableOpacity style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.cardTitulo} numberOfLines={2}>{item.titulo ?? `${item.tipo ?? 'Propiedad'} en ${item.zona ?? item.ciudad ?? '—'}`}</Text>
          <View style={[s.opBadge, { borderColor: opColor }]}>
            <Text style={[s.opTxt, { color: opColor }]}>{(item.operacion ?? '').charAt(0).toUpperCase() + (item.operacion ?? '').slice(1)}</Text>
          </View>
        </View>
        <Text style={s.precio}>{formatPrecio(item.precio, item.moneda)}</Text>
        <View style={s.cardMeta}>
          {item.tipo && <Text style={s.metaTag}>{item.tipo}</Text>}
          {item.ambientes && <Text style={s.metaTag}>{item.ambientes} amb.</Text>}
          {item.dormitorios && <Text style={s.metaTag}>{item.dormitorios} dorm.</Text>}
          {item.superficie_total && <Text style={s.metaTag}>{item.superficie_total} m²</Text>}
        </View>
        {(item.zona || item.ciudad) && (
          <Text style={s.zona}>📍 {[item.zona, item.ciudad].filter(Boolean).join(', ')}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.root}>
      <View style={s.topBar}>
        <TextInput
          style={s.search}
          placeholder="Buscar zona, tipo, título..."
          placeholderTextColor={C.textDim}
          value={busqueda}
          onChangeText={setBusqueda}
          clearButtonMode="while-editing"
        />
      </View>
      <View style={s.filtros}>
        {(['todos', 'venta', 'alquiler'] as const).map(op => (
          <TouchableOpacity key={op} style={[s.filtroBtn, filtroOp === op && s.filtroBtnActive]} onPress={() => setFiltroOp(op)}>
            <Text style={[s.filtroTxt, filtroOp === op && s.filtroTxtActive]}>
              {op.charAt(0).toUpperCase() + op.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.red} />
      ) : (
        <FlatList
          data={props}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.red} />}
          ListEmptyComponent={<Text style={s.empty}>No se encontraron propiedades</Text>}
          contentContainerStyle={{ padding: 14, paddingBottom: 30, gap: 10 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: C.bg },
  topBar:          { padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  search:          { backgroundColor: C.bgInput, borderRadius: 8, padding: 10, color: C.white, fontFamily: F.body, fontSize: 14, borderWidth: 1, borderColor: C.border },
  filtros:         { flexDirection: 'row', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  filtroBtn:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  filtroBtnActive: { backgroundColor: C.red, borderColor: C.red },
  filtroTxt:       { fontFamily: F.bold, fontSize: 12, color: C.textMid, letterSpacing: 0.5 },
  filtroTxtActive: { color: C.white },
  card:            { backgroundColor: C.bgCard, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.border },
  cardHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  cardTitulo:      { flex: 1, fontFamily: F.semi, fontSize: 14, color: C.white, lineHeight: 20 },
  opBadge:         { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  opTxt:           { fontFamily: F.bold, fontSize: 10, letterSpacing: 0.5 },
  precio:          { fontFamily: F.heading, fontSize: 18, color: C.white, marginBottom: 8 },
  cardMeta:        { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
  metaTag:         { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, fontFamily: F.body, fontSize: 11, color: C.textMid },
  zona:            { fontFamily: F.body, fontSize: 12, color: C.textDim, marginTop: 2 },
  empty:           { textAlign: 'center', marginTop: 60, fontFamily: F.body, fontSize: 14, color: C.textDim },
});
