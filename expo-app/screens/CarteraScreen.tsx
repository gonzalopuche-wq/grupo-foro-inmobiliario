import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Image, TextInput } from 'react-native';
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
  dormitorios: number | null;
  superficie_cubierta: number | null;
  estado: string | null;
  fotos: string[] | null;
}

const OP_COLOR: Record<string, string> = { venta: '#3abab6', alquiler: '#8b5cf6', ambas: C.yellow };

export default function CarteraScreen() {
  const [props, setProps] = useState<Propiedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setLoading(false); return; }
    const { data } = await supabase
      .from('cartera_propiedades')
      .select('id, titulo, tipo, operacion, precio, moneda, zona, ciudad, dormitorios, superficie_cubierta, estado, fotos')
      .eq('perfil_id', auth.user.id)
      .neq('estado', 'retirada')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setProps(data as unknown as Propiedad[]);
  }, []);

  useEffect(() => { cargar().finally(() => setLoading(false)); }, [cargar]);
  const onRefresh = async () => { setRefreshing(true); await cargar(); setRefreshing(false); };

  const fmtPrecio = (precio: number | null, moneda: string | null) => {
    if (!precio) return 'Consultar';
    return `${(moneda ?? 'USD').toUpperCase() === 'USD' ? 'USD' : '$'} ${precio.toLocaleString('es-AR')}`;
  };

  const filtradas = busqueda.length >= 2
    ? props.filter(p => `${p.titulo ?? ''} ${p.zona ?? ''} ${p.ciudad ?? ''} ${p.tipo ?? ''}`.toLowerCase().includes(busqueda.toLowerCase()))
    : props;

  const renderItem = ({ item }: { item: Propiedad }) => {
    const foto = Array.isArray(item.fotos) && item.fotos.length > 0 ? item.fotos[0] : null;
    const opColor = OP_COLOR[(item.operacion ?? '').toLowerCase()] ?? C.textDim;
    return (
      <TouchableOpacity style={s.card}>
        {foto
          ? <Image source={{ uri: foto }} style={s.foto} resizeMode="cover" />
          : <View style={[s.foto, s.fotoEmpty]}><Text style={s.fotoEmptyTxt}>🏠</Text></View>}
        <View style={s.info}>
          <Text style={s.titulo} numberOfLines={2}>
            {item.titulo ?? `${item.tipo ?? 'Propiedad'} en ${item.zona ?? item.ciudad ?? '—'}`}
          </Text>
          <Text style={s.precio}>{fmtPrecio(item.precio, item.moneda)}</Text>
          <View style={s.metaRow}>
            {item.operacion && (
              <View style={[s.opBadge, { borderColor: opColor }]}>
                <Text style={[s.opTxt, { color: opColor }]}>{item.operacion}</Text>
              </View>
            )}
            {item.tipo && <Text style={s.meta}>{item.tipo}</Text>}
            {item.dormitorios ? <Text style={s.meta}>{item.dormitorios} dorm.</Text> : null}
            {item.superficie_cubierta ? <Text style={s.meta}>{item.superficie_cubierta} m²</Text> : null}
          </View>
          {(item.zona || item.ciudad) && (
            <Text style={s.zona}>📍 {[item.zona, item.ciudad].filter(Boolean).join(', ')}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.root}>
      <View style={s.headerBar}>
        <Text style={s.headerTit}>Mi cartera</Text>
        <Text style={s.headerSub}>{props.length} propiedad{props.length === 1 ? '' : 'es'}</Text>
      </View>
      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          placeholder="Buscar por título, zona, tipo…"
          placeholderTextColor={C.textDim}
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.red} />
      ) : (
        <FlatList
          data={filtradas}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.red} />}
          ListEmptyComponent={<Text style={s.empty}>No tenés propiedades cargadas.</Text>}
          contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  headerBar:  { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerTit:  { fontFamily: F.bold, fontSize: 18, color: C.white },
  headerSub:  { fontFamily: F.body, fontSize: 12, color: C.textDim, marginTop: 2 },
  searchWrap: { paddingHorizontal: 14, paddingBottom: 8 },
  search:     { backgroundColor: C.bgInput, borderRadius: 10, borderWidth: 1, borderColor: C.border, color: C.white, paddingHorizontal: 14, paddingVertical: 10, fontFamily: F.body, fontSize: 14 },
  card:       { flexDirection: 'row', backgroundColor: C.bgCard, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  foto:       { width: 104, height: 104 },
  fotoEmpty:  { backgroundColor: C.bgInput, alignItems: 'center', justifyContent: 'center' },
  fotoEmptyTxt: { fontSize: 30 },
  info:       { flex: 1, padding: 12 },
  titulo:     { fontFamily: F.semi, fontSize: 14, color: C.white, lineHeight: 19, marginBottom: 4 },
  precio:     { fontFamily: F.heading, fontSize: 16, color: C.green, marginBottom: 6 },
  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  opBadge:    { borderWidth: 1, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 1 },
  opTxt:      { fontFamily: F.bold, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase' },
  meta:       { fontFamily: F.body, fontSize: 11, color: C.textMid },
  zona:       { fontFamily: F.body, fontSize: 11, color: C.textDim },
  empty:      { textAlign: 'center', marginTop: 60, fontFamily: F.body, fontSize: 14, color: C.textDim },
});
