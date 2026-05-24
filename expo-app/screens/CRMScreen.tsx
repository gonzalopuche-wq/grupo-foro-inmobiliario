import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Modal, Alert, ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { C, F } from '../lib/theme';

interface Contacto {
  id: string;
  nombre: string;
  apellido: string | null;
  email: string | null;
  telefono: string | null;
  estado: string | null;
  etiquetas: string[] | null;
}

const ESTADOS: Record<string, { label: string; color: string }> = {
  'lead:nuevo':      { label: 'Lead nuevo',   color: '#3b82f6' },
  'lead:contactado': { label: 'Contactado',   color: '#f59e0b' },
  'lead:calificado': { label: 'Calificado',   color: '#8b5cf6' },
  'cliente':         { label: 'Cliente',      color: '#22c55e' },
  'inactivo':        { label: 'Inactivo',     color: 'rgba(255,255,255,0.25)' },
};

export default function CRMScreen() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [modalNuevo, setModalNuevo] = useState(false);
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', telefono: '', notas: '' });
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    let query = supabase.from('crm_contactos')
      .select('id, nombre, apellido, email, telefono, estado, etiquetas')
      .eq('perfil_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (busqueda.length >= 2) {
      query = query.or(`nombre.ilike.%${busqueda}%,apellido.ilike.%${busqueda}%,email.ilike.%${busqueda}%,telefono.ilike.%${busqueda}%`);
    }
    const { data } = await query;
    if (data) setContactos(data);
  }, [busqueda]);

  useEffect(() => { setLoading(true); cargar().finally(() => setLoading(false)); }, [cargar]);

  const onRefresh = async () => { setRefreshing(true); await cargar(); setRefreshing(false); };

  const guardarContacto = async () => {
    if (!form.nombre) { Alert.alert('Ingresá al menos el nombre'); return; }
    setGuardando(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error } = await supabase.from('crm_contactos').insert({
      perfil_id: auth.user.id,
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim() || null,
      email: form.email.trim().toLowerCase() || null,
      telefono: form.telefono.trim() || null,
      notas: form.notas.trim() || null,
      estado: 'lead:nuevo',
      tipo: 'cliente',
    });
    setGuardando(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setModalNuevo(false);
    setForm({ nombre: '', apellido: '', email: '', telefono: '', notas: '' });
    cargar();
  };

  const ini = (c: Contacto) => `${c.nombre?.[0] ?? ''}${c.apellido?.[0] ?? ''}`.toUpperCase();
  const estadoInfo = (e: string | null) => ESTADOS[e ?? ''] ?? { label: e ?? '', color: C.textDim };

  const renderItem = ({ item }: { item: Contacto }) => {
    const est = estadoInfo(item.estado);
    return (
      <TouchableOpacity style={s.item}>
        <View style={[s.avatar, { backgroundColor: C.redDim, borderColor: C.red }]}>
          <Text style={[s.avatarTxt, { color: C.red }]}>{ini(item)}</Text>
        </View>
        <View style={s.itemInfo}>
          <Text style={s.itemNombre}>{item.nombre} {item.apellido ?? ''}</Text>
          <Text style={s.itemSub} numberOfLines={1}>{item.email ?? item.telefono ?? 'Sin contacto'}</Text>
        </View>
        <View style={[s.estadoBadge, { borderColor: est.color }]}>
          <Text style={[s.estadoTxt, { color: est.color }]}>{est.label}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.root}>
      {/* Buscador */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          placeholder="Buscar contacto..."
          placeholderTextColor={C.textDim}
          value={busqueda}
          onChangeText={setBusqueda}
          clearButtonMode="while-editing"
        />
        <TouchableOpacity style={s.addBtn} onPress={() => setModalNuevo(true)}>
          <Text style={s.addBtnTxt}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.red} />
      ) : (
        <FlatList
          data={contactos}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.red} />}
          ListEmptyComponent={<Text style={s.empty}>{busqueda ? 'Sin resultados' : 'No hay contactos todavía'}</Text>}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      {/* Modal nuevo contacto */}
      <Modal visible={modalNuevo} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalNuevo(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTit}>Nuevo contacto</Text>
            <TouchableOpacity onPress={() => setModalNuevo(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody}>
            {[
              { key: 'nombre', label: 'Nombre *', placeholder: 'Nombre' },
              { key: 'apellido', label: 'Apellido', placeholder: 'Apellido' },
              { key: 'email', label: 'Email', placeholder: 'email@ejemplo.com', keyboard: 'email-address' as const },
              { key: 'telefono', label: 'Teléfono', placeholder: '+54 341...', keyboard: 'phone-pad' as const },
              { key: 'notas', label: 'Notas', placeholder: 'Observaciones...' },
            ].map(field => (
              <View key={field.key} style={s.field}>
                <Text style={s.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={[s.inp, field.key === 'notas' && { height: 80, textAlignVertical: 'top' }]}
                  placeholder={field.placeholder}
                  placeholderTextColor={C.textDim}
                  value={form[field.key as keyof typeof form]}
                  onChangeText={v => setForm(f => ({ ...f, [field.key]: v }))}
                  keyboardType={field.keyboard ?? 'default'}
                  autoCapitalize={field.key === 'email' ? 'none' : 'words'}
                  multiline={field.key === 'notas'}
                />
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={[s.saveBtn, guardando && { opacity: 0.6 }]} onPress={guardarContacto} disabled={guardando}>
            {guardando ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>Guardar contacto</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  searchWrap: { flexDirection: 'row', gap: 8, padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  search:     { flex: 1, backgroundColor: C.bgInput, borderRadius: 8, padding: 10, color: C.white, fontFamily: F.body, fontSize: 14, borderWidth: 1, borderColor: C.border },
  addBtn:     { backgroundColor: C.red, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  addBtnTxt:  { fontFamily: F.bold, fontSize: 13, color: C.white },
  item:       { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
  avatar:     { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt:  { fontFamily: F.bold, fontSize: 13 },
  itemInfo:   { flex: 1 },
  itemNombre: { fontFamily: F.semi, fontSize: 14, color: C.white },
  itemSub:    { fontFamily: F.body, fontSize: 12, color: C.textMid, marginTop: 1 },
  estadoBadge:{ borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  estadoTxt:  { fontFamily: F.bold, fontSize: 10, letterSpacing: 0.5 },
  empty:      { textAlign: 'center', marginTop: 60, fontFamily: F.body, fontSize: 14, color: C.textDim },
  modal:      { flex: 1, backgroundColor: C.bg },
  modalHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTit:   { fontFamily: F.bold, fontSize: 18, color: C.white },
  modalClose: { fontSize: 20, color: C.textMid, padding: 4 },
  modalBody:  { flex: 1, padding: 20 },
  field:      { marginBottom: 16 },
  fieldLabel: { fontFamily: F.medium, fontSize: 12, color: C.textMid, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  inp:        { backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12, color: C.white, fontFamily: F.body, fontSize: 14 },
  saveBtn:    { backgroundColor: C.red, margin: 20, borderRadius: 10, padding: 16, alignItems: 'center' },
  saveBtnTxt: { fontFamily: F.bold, fontSize: 14, color: C.white, letterSpacing: 1, textTransform: 'uppercase' },
});
