import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { C, F } from '../lib/theme';
import { useRelevamientos } from '../state/relevamiento';
import { TONOS, areaAmbiente, superficieTotal } from '../lib/types';
import { apiPost } from '../lib/api';

export default function DescripcionScreen() {
  const { current, setCampo, guardar } = useRelevamientos();
  const [tono, setTono] = useState(current?.tono ?? 'profesional');
  const [loading, setLoading] = useState(false);
  const [texto, setTexto] = useState(current?.descripcionIa ?? '');

  if (!current) {
    return <View style={s.center}><Text style={s.emptyTxt}>Abrí un relevamiento.</Text></View>;
  }

  const fotosCount = current.ambientes.filter((a) => a.fotoBase64).length;

  const generar = async () => {
    setLoading(true);
    try {
      const relevamiento = {
        titulo: current.titulo,
        direccion: current.direccion,
        tipo: current.tipo,
        operacion: current.operacion,
        alto_techo: current.altoTecho,
        superficie_total: superficieTotal(current.ambientes),
        ambientes: current.ambientes.map((a) => ({
          nombre: a.nombre, largo: a.largo, ancho: a.ancho, alto: a.alto, area: areaAmbiente(a),
        })),
      };
      const fotos = current.ambientes
        .filter((a) => a.fotoBase64)
        .map((a) => ({ ambiente: a.nombre, media_type: 'image/jpeg', data: a.fotoBase64 }));

      const { descripcion } = await apiPost<{ descripcion: string }>('/api/mide/descripcion', { relevamiento, fotos, tono });
      setTexto(descripcion);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo generar la descripción.');
    } finally {
      setLoading(false);
    }
  };

  const guardarTexto = () => {
    setCampo({ descripcionIa: texto, tono });
    guardar();
    Alert.alert('Guardado', 'Descripción guardada en el relevamiento.');
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text style={s.label}>Tono</Text>
      <View style={s.chipRow}>
        {TONOS.map((t) => (
          <TouchableOpacity key={t} style={[s.chip, tono === t && s.chipOn]} onPress={() => setTono(t)}>
            <Text style={[s.chipTxt, tono === t && s.chipTxtOn]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.fotoNota}>
        {fotosCount > 0
          ? `Se usarán ${fotosCount} foto${fotosCount === 1 ? '' : 's'} del recorrido + las medidas.`
          : 'Sin fotos del recorrido: la descripción se basará solo en las medidas. Tomá fotos en la pantalla de medición para mejores resultados.'}
      </Text>

      <TouchableOpacity style={[s.genBtn, loading && { opacity: 0.6 }]} onPress={generar} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.genTxt}>✨  Generar descripción</Text>}
      </TouchableOpacity>

      <TextInput
        style={s.textarea}
        value={texto}
        onChangeText={setTexto}
        placeholder="Acá aparecerá la descripción generada (podés editarla)."
        placeholderTextColor={C.textDim}
        multiline
        textAlignVertical="top"
      />

      {!!texto && (
        <TouchableOpacity style={s.saveBtn} onPress={guardarTexto}>
          <Text style={s.saveTxt}>Guardar descripción</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  center:    { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  emptyTxt:  { fontFamily: F.body, fontSize: 14, color: C.textMid },
  label:     { fontFamily: F.semi, fontSize: 11, color: C.textMid, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip:      { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgInput },
  chipOn:    { backgroundColor: C.redDim, borderColor: C.red },
  chipTxt:   { fontFamily: F.semi, fontSize: 12, color: C.textMid, textTransform: 'capitalize' },
  chipTxtOn: { color: C.white },
  fotoNota:  { fontFamily: F.body, fontSize: 12, color: C.textDim, marginBottom: 16, lineHeight: 18 },
  genBtn:    { backgroundColor: C.red, borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 16 },
  genTxt:    { fontFamily: F.bold, fontSize: 14, color: '#fff' },
  textarea:  { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, color: C.white, fontFamily: F.body, fontSize: 15, lineHeight: 22, minHeight: 200 },
  saveBtn:   { borderWidth: 1, borderColor: C.green, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 14 },
  saveTxt:   { fontFamily: F.bold, fontSize: 14, color: C.green },
});
