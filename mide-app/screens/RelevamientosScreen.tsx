import React, { useLayoutEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { C, F } from '../lib/theme';
import { useRelevamientos } from '../state/relevamiento';
import { superficieTotal } from '../lib/types';
import type { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Relevamientos'>;

export default function RelevamientosScreen({ navigation }: Props) {
  const { relevamientos, loading, refresh, crear, abrir, eliminar } = useRelevamientos();
  const [refreshing, setRefreshing] = useState(false);
  const [creando, setCreando] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => supabase.auth.signOut()} hitSlop={10}>
          <Text style={s.salir}>Salir</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const nuevo = async () => {
    setCreando(true);
    const rel = await crear();
    setCreando(false);
    if (rel) navigation.navigate('Medicion');
    else Alert.alert('Error', 'No se pudo crear el relevamiento.');
  };

  const confirmarBorrar = (id: string, titulo: string) => {
    Alert.alert('Eliminar', `¿Eliminar "${titulo}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => eliminar(id) },
    ]);
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={C.red} size="large" /></View>;
  }

  return (
    <View style={s.root}>
      <FlatList
        data={relevamientos}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.red} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Sin relevamientos</Text>
            <Text style={s.emptyTxt}>Tocá “Nuevo relevamiento” para medir tu primera propiedad.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const total = superficieTotal(item.ambientes);
          return (
            <TouchableOpacity
              style={s.card}
              onPress={() => { abrir(item.id); navigation.navigate('Medicion'); }}
              onLongPress={() => confirmarBorrar(item.id, item.titulo)}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{item.titulo}</Text>
                <Text style={s.cardSub} numberOfLines={1}>
                  {item.direccion || 'Sin dirección'}
                </Text>
                <Text style={s.cardMeta}>
                  {item.ambientes.length} ambiente{item.ambientes.length === 1 ? '' : 's'} · {total.toFixed(1)} m²
                </Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={[s.fab, creando && { opacity: 0.6 }]} onPress={nuevo} disabled={creando}>
        {creando ? <ActivityIndicator color="#fff" /> : <Text style={s.fabTxt}>＋  Nuevo relevamiento</Text>}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  center:    { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  salir:     { color: C.textMid, fontFamily: F.semi, fontSize: 13 },
  card:      { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontFamily: F.bold, fontSize: 15, color: C.white },
  cardSub:   { fontFamily: F.body, fontSize: 12, color: C.textMid, marginTop: 2 },
  cardMeta:  { fontFamily: F.semi, fontSize: 12, color: C.red, marginTop: 6 },
  chevron:   { fontFamily: F.body, fontSize: 28, color: C.textDim, marginLeft: 8 },
  empty:     { alignItems: 'center', marginTop: 80, paddingHorizontal: 30 },
  emptyTitle:{ fontFamily: F.bold, fontSize: 16, color: C.text },
  emptyTxt:  { fontFamily: F.body, fontSize: 13, color: C.textMid, textAlign: 'center', marginTop: 8 },
  fab:       { position: 'absolute', left: 16, right: 16, bottom: 24, backgroundColor: C.red, borderRadius: 12, padding: 16, alignItems: 'center' },
  fabTxt:    { fontFamily: F.bold, fontSize: 14, color: C.white, letterSpacing: 0.5 },
});
