import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { C, F } from '../lib/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = { navigation: NativeStackNavigationProp<any> };

interface Mensaje {
  id: string;
  texto: string;
  created_at: string;
  perfiles?: { nombre: string; apellido: string; foto_url: string | null };
}

export default function ComunidadScreen({ navigation }: Props) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = async () => {
    const { data } = await supabase
      .from('mensajes_chat')
      .select('id, texto, created_at, perfiles(nombre, apellido, foto_url)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setMensajes(data as unknown as Mensaje[]);
  };

  useEffect(() => { cargar().finally(() => setLoading(false)); }, []);

  const onRefresh = async () => { setRefreshing(true); await cargar(); setRefreshing(false); };

  const renderItem = ({ item }: { item: Mensaje }) => {
    const p = item.perfiles;
    const ini = `${p?.nombre?.[0] ?? '?'}${p?.apellido?.[0] ?? ''}`.toUpperCase();
    const tiempo = (() => {
      const d = new Date(item.created_at);
      const ahora = new Date();
      const diff = Math.floor((ahora.getTime() - d.getTime()) / 60000);
      if (diff < 1) return 'ahora';
      if (diff < 60) return `${diff}m`;
      if (diff < 1440) return `${Math.floor(diff / 60)}h`;
      return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    })();

    return (
      <View style={s.msg}>
        <View style={s.msgAvatar}>
          <Text style={s.msgAvatarTxt}>{ini}</Text>
        </View>
        <View style={s.msgBody}>
          <View style={s.msgMeta}>
            <Text style={s.msgNombre}>{p?.nombre ?? 'Usuario'} {p?.apellido ?? ''}</Text>
            <Text style={s.msgTime}>{tiempo}</Text>
          </View>
          <Text style={s.msgTxt}>{item.texto}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={s.root}>
      {/* Accesos rápidos */}
      <View style={s.quickNav}>
        <TouchableOpacity style={s.quickBtn} onPress={() => navigation.navigate('Foro')}>
          <Text style={s.quickIcon}>🗣️</Text>
          <Text style={s.quickLabel}>Foro GFI</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.quickBtn} onPress={() => navigation.navigate('Eventos')}>
          <Text style={s.quickIcon}>📅</Text>
          <Text style={s.quickLabel}>Eventos</Text>
        </TouchableOpacity>
      </View>

      <View style={s.sectionHeader}>
        <Text style={s.sectionTit}>Chat general</Text>
        <Text style={s.sectionSub}>{mensajes.length} mensajes recientes</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.red} />
      ) : (
        <FlatList
          data={mensajes}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.red} />}
          ListEmptyComponent={<Text style={s.empty}>No hay mensajes recientes</Text>}
          contentContainerStyle={{ paddingBottom: 20 }}
          inverted={mensajes.length > 0}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  quickNav:     { flexDirection: 'row', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  quickBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bgCard, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: C.border },
  quickIcon:    { fontSize: 22 },
  quickLabel:   { fontFamily: F.semi, fontSize: 14, color: C.text },
  sectionHeader:{ padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  sectionTit:   { fontFamily: F.bold, fontSize: 14, color: C.white },
  sectionSub:   { fontFamily: F.body, fontSize: 11, color: C.textDim, marginTop: 2 },
  msg:          { flexDirection: 'row', padding: 14, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  msgAvatar:    { width: 36, height: 36, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  msgAvatarTxt: { fontFamily: F.bold, fontSize: 11, color: C.textMid },
  msgBody:      { flex: 1 },
  msgMeta:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  msgNombre:    { fontFamily: F.semi, fontSize: 13, color: C.text },
  msgTime:      { fontFamily: F.body, fontSize: 11, color: C.textDim },
  msgTxt:       { fontFamily: F.body, fontSize: 13, color: C.textMid, lineHeight: 19 },
  empty:        { textAlign: 'center', marginTop: 60, fontFamily: F.body, fontSize: 14, color: C.textDim },
});
