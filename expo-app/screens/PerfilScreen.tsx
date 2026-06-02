import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { C, F } from '../lib/theme';

interface Perfil {
  nombre: string;
  apellido: string;
  matricula: string | null;
  tipo: string | null;
  telefono: string | null;
}

export default function PerfilScreen() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setEmail(auth.user.email ?? null);
      const { data } = await supabase
        .from('perfiles')
        .select('nombre, apellido, matricula, tipo, telefono')
        .eq('id', auth.user.id)
        .single();
      if (data) setPerfil(data);
      setLoading(false);
    };
    cargar();
  }, []);

  const cerrarSesion = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive',
        onPress: async () => {
          setCerrando(true);
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const ini = perfil ? `${perfil.nombre?.[0] ?? ''}${perfil.apellido?.[0] ?? ''}`.toUpperCase() : '?';
  const tipoBadge = perfil?.tipo === 'admin' ? 'Admin' : perfil?.tipo === 'colaborador' ? 'Colaborador' : 'Corredor';

  if (loading) return <ActivityIndicator style={{ flex: 1, backgroundColor: C.bg }} color={C.red} />;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.scroll}>
      {/* Avatar */}
      <View style={s.avatarWrap}>
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{ini}</Text>
        </View>
        <Text style={s.nombre}>{perfil?.nombre} {perfil?.apellido}</Text>
        <View style={s.tipoBadge}>
          <Text style={s.tipoBadgeTxt}>{tipoBadge}</Text>
        </View>
        {perfil?.matricula && <Text style={s.matricula}>Mat. {perfil.matricula}</Text>}
      </View>

      {/* Datos */}
      <View style={s.section}>
        <Text style={s.sectionTit}>Información</Text>
        {[
          { label: 'Email', value: email },
          { label: 'Teléfono', value: perfil?.telefono },
          { label: 'Matrícula', value: perfil?.matricula },
          { label: 'Tipo de cuenta', value: tipoBadge },
        ].map(({ label, value }) => value ? (
          <View key={label} style={s.row}>
            <Text style={s.rowLabel}>{label}</Text>
            <Text style={s.rowValue}>{value}</Text>
          </View>
        ) : null)}
      </View>

      {/* Acciones */}
      <View style={s.section}>
        <Text style={s.sectionTit}>Cuenta</Text>
        <TouchableOpacity style={s.actionRow}>
          <Text style={s.actionTxt}>🔒  Cambiar contraseña</Text>
          <Text style={s.actionArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionRow}>
          <Text style={s.actionTxt}>🔔  Notificaciones</Text>
          <Text style={s.actionArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Cerrar sesión */}
      <TouchableOpacity
        style={[s.logoutBtn, cerrando && { opacity: 0.6 }]}
        onPress={cerrarSesion}
        disabled={cerrando}
      >
        {cerrando
          ? <ActivityIndicator color={C.red} />
          : <Text style={s.logoutTxt}>Cerrar sesión</Text>
        }
      </TouchableOpacity>

      <Text style={s.version}>GFI® v1.0.0</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  scroll:       { padding: 20, paddingBottom: 40 },
  avatarWrap:   { alignItems: 'center', marginBottom: 28 },
  avatar:       { width: 80, height: 80, borderRadius: 20, backgroundColor: C.redDim, borderWidth: 2, borderColor: C.red, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarTxt:    { fontFamily: F.heading, fontSize: 28, color: C.red },
  nombre:       { fontFamily: F.bold, fontSize: 20, color: C.white, marginBottom: 8 },
  tipoBadge:    { backgroundColor: C.redDim, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1, borderColor: C.red, marginBottom: 6 },
  tipoBadgeTxt: { fontFamily: F.bold, fontSize: 11, color: C.red, letterSpacing: 1, textTransform: 'uppercase' },
  matricula:    { fontFamily: F.body, fontSize: 12, color: C.textDim },
  section:      { backgroundColor: C.bgCard, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 16, overflow: 'hidden' },
  sectionTit:   { fontFamily: F.bold, fontSize: 10, color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase', padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  row:          { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  rowLabel:     { fontFamily: F.body, fontSize: 13, color: C.textMid },
  rowValue:     { fontFamily: F.medium, fontSize: 13, color: C.text, maxWidth: '60%', textAlign: 'right' },
  actionRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  actionTxt:    { fontFamily: F.medium, fontSize: 14, color: C.text },
  actionArrow:  { fontFamily: F.body, fontSize: 20, color: C.textDim },
  logoutBtn:    { borderWidth: 1, borderColor: 'rgba(153,0,0,0.4)', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 20 },
  logoutTxt:    { fontFamily: F.bold, fontSize: 14, color: C.red, letterSpacing: 0.5 },
  version:      { textAlign: 'center', fontFamily: F.body, fontSize: 11, color: C.textDim },
});
