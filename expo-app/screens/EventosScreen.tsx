import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import { C, F } from '../lib/theme';

interface Evento {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;        // 'YYYY-MM-DD'
  hora: string | null;
  lugar: string | null;
  tipo: string | null;
  link_externo: string | null;
  imagen_url: string | null;
}

export default function EventosScreen() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'proximos' | 'pasados'>('proximos');

  const cargar = async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('eventos')
      .select('id, titulo, descripcion, fecha, hora, lugar, tipo, link_externo, imagen_url')
      .order('fecha', { ascending: tab === 'proximos' })
      .filter('fecha', tab === 'proximos' ? 'gte' : 'lt', hoy)
      .limit(30);
    if (data) setEventos(data as unknown as Evento[]);
  };

  useEffect(() => { setLoading(true); cargar().finally(() => setLoading(false)); }, [tab]);

  const onRefresh = async () => { setRefreshing(true); await cargar(); setRefreshing(false); };

  // La fecha es un DATE ('YYYY-MM-DD'); se ancla a mediodía para evitar corrimientos
  // de día por zona horaria.
  const fechaLocal = (f: string) => new Date(`${f}T12:00:00`);

  const renderItem = ({ item }: { item: Evento }) => (
    <View style={s.card}>
      <View style={s.cardDate}>
        <Text style={s.cardDay}>{fechaLocal(item.fecha).getDate()}</Text>
        <Text style={s.cardMonth}>
          {fechaLocal(item.fecha).toLocaleDateString('es-AR', { month: 'short' }).toUpperCase()}
        </Text>
      </View>
      <View style={s.cardInfo}>
        <Text style={s.cardTit} numberOfLines={2}>{item.titulo}</Text>
        <Text style={s.cardHora}>{item.hora ?? ''}{item.lugar ? `  •  ${item.lugar}` : ''}</Text>
        {item.descripcion && <Text style={s.cardDesc} numberOfLines={2}>{item.descripcion}</Text>}
        {item.link_externo && (
          <TouchableOpacity onPress={() => Linking.openURL(item.link_externo!).catch(() => {})} style={s.regBtn}>
            <Text style={s.regBtnTxt}>Inscribirse</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      <View style={s.tabs}>
        {(['proximos', 'pasados'] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
              {t === 'proximos' ? 'Próximos' : 'Pasados'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.red} />
      ) : (
        <FlatList
          data={eventos}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.red} />}
          ListEmptyComponent={
            <Text style={s.empty}>{tab === 'proximos' ? 'No hay eventos próximos' : 'No hay eventos pasados'}</Text>
          }
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
  card:       { flexDirection: 'row', backgroundColor: C.bgCard, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.border, gap: 14 },
  cardDate:   { alignItems: 'center', justifyContent: 'center', width: 44, backgroundColor: C.redDim, borderRadius: 10, borderWidth: 1, borderColor: C.red, padding: 6 },
  cardDay:    { fontFamily: F.heading, fontSize: 22, color: C.red, lineHeight: 26 },
  cardMonth:  { fontFamily: F.bold, fontSize: 9, color: C.red, letterSpacing: 1 },
  cardInfo:   { flex: 1 },
  cardTit:    { fontFamily: F.semi, fontSize: 15, color: C.white, lineHeight: 20, marginBottom: 4 },
  cardHora:   { fontFamily: F.body, fontSize: 12, color: C.textMid, marginBottom: 6 },
  cardDesc:   { fontFamily: F.body, fontSize: 12, color: C.textDim, lineHeight: 17, marginBottom: 8 },
  regBtn:     { alignSelf: 'flex-start', backgroundColor: C.red, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 6 },
  regBtnTxt:  { fontFamily: F.bold, fontSize: 12, color: C.white },
  empty:      { textAlign: 'center', marginTop: 60, fontFamily: F.body, fontSize: 14, color: C.textDim },
});
