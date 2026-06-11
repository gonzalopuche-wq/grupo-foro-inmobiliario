import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import { C, F } from '../lib/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = { navigation: NativeStackNavigationProp<any> };

interface Stats {
  contactos: number;
  tareasPendientes: number;
  propiedades: number;
  leadsHoy: number;
}

export default function DashboardScreen({ navigation }: Props) {
  const [perfil, setPerfil] = useState<{ nombre: string; apellido: string; matricula: string } | null>(null);
  const [stats, setStats] = useState<Stats>({ contactos: 0, tareasPendientes: 0, propiedades: 0, leadsHoy: 0 });
  const [eventos, setEventos] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const uid = auth.user.id;

    const [perfilRes, contactosRes, tareasRes, propsRes, eventosRes] = await Promise.all([
      supabase.from('perfiles').select('nombre, apellido, matricula').eq('id', uid).single(),
      supabase.from('crm_contactos').select('id', { count: 'exact', head: true }).eq('perfil_id', uid),
      supabase.from('crm_tareas').select('id', { count: 'exact', head: true }).eq('perfil_id', uid).eq('estado', 'pendiente'),
      supabase.from('cartera_propiedades').select('id', { count: 'exact', head: true }).eq('perfil_id', uid).neq('estado', 'retirada'),
      supabase.from('eventos').select('id, titulo, fecha, hora, lugar').gte('fecha', new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)).order('fecha').limit(3),
    ]);

    if (perfilRes.data) setPerfil(perfilRes.data);
    setStats({
      contactos: contactosRes.count ?? 0,
      tareasPendientes: tareasRes.count ?? 0,
      propiedades: propsRes.count ?? 0,
      leadsHoy: 0,
    });
    if (eventosRes.data) setEventos(eventosRes.data);
  };

  useEffect(() => { cargar(); }, []);

  const onRefresh = async () => { setRefreshing(true); await cargar(); setRefreshing(false); };

  const tarjeta = (valor: number, label: string, color: string, onPress?: () => void) => (
    <TouchableOpacity style={[s.card, { borderLeftColor: color, borderLeftWidth: 3 }]} onPress={onPress} key={label}>
      <Text style={[s.cardNum, { color }]}>{valor}</Text>
      <Text style={s.cardLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={s.root} contentContainerStyle={s.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.red} />}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.hola}>Buenos días{perfil ? `, ${perfil.nombre}` : ''}</Text>
          {perfil?.matricula ? <Text style={s.mat}>Mat. {perfil.matricula}</Text> : null}
        </View>
        <View style={s.badge}>
          <Text style={s.badgeTxt}>{(perfil?.nombre?.[0] ?? '') + (perfil?.apellido?.[0] ?? '')}</Text>
        </View>
      </View>

      {/* Stats */}
      <Text style={s.section}>Resumen</Text>
      <View style={s.cards}>
        {tarjeta(stats.contactos, 'Contactos', C.blue, () => navigation.navigate('CRMTab'))}
        {tarjeta(stats.tareasPendientes, 'Tareas vencidas', C.yellow, () => navigation.navigate('CRMTab'))}
        {tarjeta(stats.propiedades, 'Propiedades', C.green)}
      </View>

      {/* Accesos rápidos */}
      <Text style={s.section}>Accesos rápidos</Text>
      <View style={s.quickRow}>
        {[
          { label: 'CRM', icon: '👥', tab: 'CRMTab' },
          { label: 'MIR', icon: '🔄', tab: 'MIRTab' },
          { label: 'Foro', icon: '🗣️', tab: 'ComunidadTab', screen: 'Foro' },
          { label: 'Eventos', icon: '📅', tab: 'ComunidadTab', screen: 'Eventos' },
        ].map(item => (
          <TouchableOpacity key={item.label} style={s.quick}
            onPress={() => {
              if (item.screen) navigation.navigate(item.tab as any, { screen: item.screen });
              else navigation.navigate(item.tab as any);
            }}>
            <Text style={s.quickIcon}>{item.icon}</Text>
            <Text style={s.quickLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Próximos eventos */}
      {eventos.length > 0 && (
        <>
          <Text style={s.section}>Próximos eventos</Text>
          {eventos.map(ev => (
            <View key={ev.id} style={s.eventoCard}>
              <Text style={s.eventoTit}>{ev.titulo}</Text>
              <Text style={s.eventoSub}>
                {ev.fecha ? new Date(`${ev.fecha}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) : ''}
                {ev.hora ? `  •  ${ev.hora}` : ''}{ev.lugar ? `  •  ${ev.lugar}` : ''}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  scroll:     { padding: 20, paddingBottom: 40 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  hola:       { fontFamily: F.bold, fontSize: 20, color: C.white },
  mat:        { fontFamily: F.body, fontSize: 12, color: C.textDim, marginTop: 2 },
  badge:      { width: 42, height: 42, borderRadius: 12, backgroundColor: C.redDim, borderWidth: 1, borderColor: C.red, alignItems: 'center', justifyContent: 'center' },
  badgeTxt:   { fontFamily: F.bold, fontSize: 13, color: C.red },
  section:    { fontFamily: F.bold, fontSize: 12, color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
  cards:      { flexDirection: 'row', gap: 10, marginBottom: 8 },
  card:       { flex: 1, backgroundColor: C.bgCard, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: C.border },
  cardNum:    { fontFamily: F.heading, fontSize: 26 },
  cardLabel:  { fontFamily: F.body, fontSize: 11, color: C.textMid, marginTop: 2 },
  quickRow:   { flexDirection: 'row', gap: 10, marginBottom: 8 },
  quick:      { flex: 1, backgroundColor: C.bgCard, borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  quickIcon:  { fontSize: 24, marginBottom: 6 },
  quickLabel: { fontFamily: F.medium, fontSize: 11, color: C.text },
  eventoCard: { backgroundColor: C.bgCard, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border, borderLeftWidth: 3, borderLeftColor: C.red },
  eventoTit:  { fontFamily: F.semi, fontSize: 14, color: C.white, marginBottom: 4 },
  eventoSub:  { fontFamily: F.body, fontSize: 12, color: C.textMid },
});
