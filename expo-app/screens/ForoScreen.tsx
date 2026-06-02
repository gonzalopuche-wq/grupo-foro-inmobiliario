import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { C, F } from '../lib/theme';

interface Post {
  id: string;
  titulo: string;
  contenido: string | null;
  created_at: string;
  categoria: string | null;
  respuestas_count?: number;
  perfiles?: { nombre: string; apellido: string };
}

const CAT_COLORS: Record<string, string> = {
  general: C.blue,
  consulta: C.yellow,
  venta: '#3abab6',
  alquiler: '#8b5cf6',
  noticia: C.red,
};

export default function ForoScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = async () => {
    const { data } = await supabase
      .from('forum_posts')
      .select('id, titulo, contenido, created_at, categoria, perfiles(nombre, apellido)')
      .order('created_at', { ascending: false })
      .limit(40);
    if (data) setPosts(data as unknown as Post[]);
  };

  useEffect(() => { cargar().finally(() => setLoading(false)); }, []);

  const onRefresh = async () => { setRefreshing(true); await cargar(); setRefreshing(false); };

  const tiempo = (iso: string) => {
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return 'ahora';
    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    if (diff < 10080) return `${Math.floor(diff / 1440)}d`;
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  };

  const renderItem = ({ item }: { item: Post }) => {
    const catColor = CAT_COLORS[(item.categoria ?? '').toLowerCase()] ?? C.textDim;
    const p = item.perfiles;
    return (
      <TouchableOpacity style={s.post}>
        <View style={s.postHeader}>
          {item.categoria && (
            <View style={[s.catBadge, { borderColor: catColor }]}>
              <Text style={[s.catTxt, { color: catColor }]}>{item.categoria}</Text>
            </View>
          )}
          <Text style={s.postTime}>{tiempo(item.created_at)}</Text>
        </View>
        <Text style={s.postTit} numberOfLines={2}>{item.titulo}</Text>
        {item.contenido && (
          <Text style={s.postPrev} numberOfLines={2}>{item.contenido}</Text>
        )}
        <Text style={s.postAutor}>
          {p ? `${p.nombre} ${p.apellido ?? ''}`.trim() : 'GFI'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.root}>
      <View style={s.headerBar}>
        <Text style={s.headerTit}>Foro GFI</Text>
        <Text style={s.headerSub}>Debates y consultas de la comunidad</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.red} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.red} />}
          ListEmptyComponent={<Text style={s.empty}>El foro está vacío por ahora</Text>}
          contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 30 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  headerBar:  { padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTit:  { fontFamily: F.bold, fontSize: 18, color: C.white },
  headerSub:  { fontFamily: F.body, fontSize: 12, color: C.textDim, marginTop: 2 },
  post:       { backgroundColor: C.bgCard, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.border },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  catBadge:   { borderWidth: 1, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 2 },
  catTxt:     { fontFamily: F.bold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  postTime:   { fontFamily: F.body, fontSize: 11, color: C.textDim },
  postTit:    { fontFamily: F.semi, fontSize: 15, color: C.white, lineHeight: 21, marginBottom: 6 },
  postPrev:   { fontFamily: F.body, fontSize: 13, color: C.textMid, lineHeight: 18, marginBottom: 8 },
  postAutor:  { fontFamily: F.body, fontSize: 11, color: C.textDim },
  empty:      { textAlign: 'center', marginTop: 60, fontFamily: F.body, fontSize: 14, color: C.textDim },
});
