import React, { useLayoutEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { C, F } from '../lib/theme';
import { useRelevamientos } from '../state/relevamiento';
import {
  Ambiente, OPERACIONES, TIPOS, nuevoAmbiente, superficieTotal,
} from '../lib/types';
import AmbienteCard from '../components/AmbienteCard';
import CamaraMedir from '../components/CamaraMedir';
import CamaraFoto from '../components/CamaraFoto';
import type { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Medicion'>;

export default function MedicionScreen({ navigation }: Props) {
  const { current, setCampo, setAmbientes, guardar } = useRelevamientos();
  const [medir, setMedir] = useState<{ id: string; field: 'largo' | 'ancho'; nombre: string } | null>(null);
  const [foto, setFoto] = useState<{ id: string; nombre: string } | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => { guardar(); Alert.alert('Guardado', 'Relevamiento guardado.'); }} hitSlop={10}>
          <Text style={s.guardar}>Guardar</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, guardar]);

  if (!current) {
    return (
      <View style={s.center}>
        <Text style={s.emptyTxt}>Abrí un relevamiento desde la lista.</Text>
      </View>
    );
  }

  const ambientes = current.ambientes;
  const total = superficieTotal(ambientes);

  const patchAmbiente = (id: string, patch: Partial<Ambiente>) =>
    setAmbientes(ambientes.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const agregar = () =>
    setAmbientes([...ambientes, nuevoAmbiente(current.altoTecho, ambientes.length + 1)]);

  const borrar = (id: string) => setAmbientes(ambientes.filter((a) => a.id !== id));

  const irA = (pantalla: 'Plano' | 'Tour3D' | 'Descripcion') => {
    if (ambientes.length === 0) { Alert.alert('Agregá al menos un ambiente primero.'); return; }
    guardar();
    navigation.navigate(pantalla);
  };

  return (
    <>
      <ScrollView style={s.root} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Datos generales */}
        <View style={s.metaCard}>
          <TextInput
            style={s.titulo}
            value={current.titulo}
            onChangeText={(titulo) => setCampo({ titulo })}
            placeholder="Título (ej. Depto Pellegrini 1200)"
            placeholderTextColor={C.textDim}
          />
          <TextInput
            style={s.direccion}
            value={current.direccion ?? ''}
            onChangeText={(direccion) => setCampo({ direccion })}
            placeholder="Dirección / zona"
            placeholderTextColor={C.textDim}
          />

          <Text style={s.chipLabel}>Tipo</Text>
          <View style={s.chipRow}>
            {TIPOS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[s.chip, current.tipo === t && s.chipOn]}
                onPress={() => setCampo({ tipo: current.tipo === t ? undefined : t })}
              >
                <Text style={[s.chipTxt, current.tipo === t && s.chipTxtOn]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.chipLabel}>Operación</Text>
          <View style={s.chipRow}>
            {OPERACIONES.map((o) => (
              <TouchableOpacity
                key={o}
                style={[s.chip, current.operacion === o && s.chipOn]}
                onPress={() => setCampo({ operacion: current.operacion === o ? undefined : o })}
              >
                <Text style={[s.chipTxt, current.operacion === o && s.chipTxtOn]}>{o}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Ambientes */}
        {ambientes.map((a) => (
          <AmbienteCard
            key={a.id}
            ambiente={a}
            onChange={(patch) => patchAmbiente(a.id, patch)}
            onDelete={() => borrar(a.id)}
            onMedir={(field) => setMedir({ id: a.id, field, nombre: a.nombre })}
            onFoto={() => setFoto({ id: a.id, nombre: a.nombre })}
          />
        ))}

        <TouchableOpacity style={s.addBtn} onPress={agregar}>
          <Text style={s.addTxt}>＋  Agregar ambiente</Text>
        </TouchableOpacity>

        <View style={s.totalRow}>
          <Text style={s.totalLbl}>Superficie total</Text>
          <Text style={s.totalVal}>{total.toFixed(2)} m²</Text>
        </View>

        {/* Acciones */}
        <View style={s.acciones}>
          <TouchableOpacity style={s.accion} onPress={() => irA('Plano')}>
            <Text style={s.accionIcon}>📐</Text><Text style={s.accionTxt}>Plano 2D</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.accion} onPress={() => irA('Tour3D')}>
            <Text style={s.accionIcon}>🧊</Text><Text style={s.accionTxt}>Recorrido 3D</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.accion} onPress={() => irA('Descripcion')}>
            <Text style={s.accionIcon}>✨</Text><Text style={s.accionTxt}>Descripción IA</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <CamaraMedir
        visible={!!medir}
        objetivo={medir ? `${medir.field} del ${medir.nombre}` : ''}
        onClose={() => setMedir(null)}
        onMedida={(m) => { if (medir) patchAmbiente(medir.id, { [medir.field]: m }); setMedir(null); }}
      />
      <CamaraFoto
        visible={!!foto}
        ambiente={foto?.nombre ?? ''}
        onClose={() => setFoto(null)}
        onCapture={({ uri, base64 }) => { if (foto) patchAmbiente(foto.id, { fotoUri: uri, fotoBase64: base64 }); setFoto(null); }}
      />
    </>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  center:     { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  emptyTxt:   { fontFamily: F.body, fontSize: 14, color: C.textMid },
  guardar:    { fontFamily: F.bold, fontSize: 14, color: C.red },
  metaCard:   { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 14 },
  titulo:     { fontFamily: F.bold, fontSize: 16, color: C.white, borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 6, marginBottom: 8 },
  direccion:  { fontFamily: F.body, fontSize: 14, color: C.text, paddingVertical: 6, marginBottom: 8 },
  chipLabel:  { fontFamily: F.semi, fontSize: 11, color: C.textMid, marginTop: 6, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:       { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgInput },
  chipOn:     { backgroundColor: C.redDim, borderColor: C.red },
  chipTxt:    { fontFamily: F.semi, fontSize: 12, color: C.textMid, textTransform: 'capitalize' },
  chipTxtOn:  { color: C.white },
  addBtn:     { borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  addTxt:     { fontFamily: F.bold, fontSize: 14, color: C.text },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  totalLbl:   { fontFamily: F.semi, fontSize: 14, color: C.text },
  totalVal:   { fontFamily: F.heading, fontSize: 22, color: C.green },
  acciones:   { flexDirection: 'row', gap: 10 },
  accion:     { flex: 1, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  accionIcon: { fontSize: 22, marginBottom: 6 },
  accionTxt:  { fontFamily: F.semi, fontSize: 12, color: C.text, textAlign: 'center' },
});
