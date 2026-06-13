import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image } from 'react-native';
import { C, F } from '../lib/theme';
import { Ambiente, areaAmbiente } from '../lib/types';

interface Props {
  ambiente: Ambiente;
  onChange: (patch: Partial<Ambiente>) => void;
  onDelete: () => void;
  onMedir: (field: 'largo' | 'ancho') => void;
  onFoto: () => void;
}

function NumField({
  label, value, onChange, onMedir,
}: { label: string; value: number; onChange: (v: number) => void; onMedir?: () => void }) {
  const set = (v: number) => onChange(Math.max(0, Math.round(v * 100) / 100));
  return (
    <View style={s.numWrap}>
      <Text style={s.numLabel}>{label}</Text>
      <View style={s.numRow}>
        <TouchableOpacity style={s.stepBtn} onPress={() => set(value - 0.1)}><Text style={s.stepTxt}>−</Text></TouchableOpacity>
        <TextInput
          style={s.numInput}
          value={value ? String(value) : ''}
          onChangeText={(t) => set(parseFloat(t.replace(',', '.')) || 0)}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
        <TouchableOpacity style={s.stepBtn} onPress={() => set(value + 0.1)}><Text style={s.stepTxt}>＋</Text></TouchableOpacity>
        {onMedir && (
          <TouchableOpacity style={s.medirBtn} onPress={onMedir}>
            <Text style={s.medirTxt}>📐</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function AmbienteCard({ ambiente, onChange, onDelete, onMedir, onFoto }: Props) {
  const area = areaAmbiente(ambiente);
  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <TextInput
          style={s.nombre}
          value={ambiente.nombre}
          onChangeText={(nombre) => onChange({ nombre })}
          placeholder="Nombre del ambiente"
          placeholderTextColor={C.textDim}
        />
        <TouchableOpacity onPress={onDelete} hitSlop={10}><Text style={s.del}>✕</Text></TouchableOpacity>
      </View>

      <View style={s.dimsRow}>
        <NumField label="Largo (m)" value={ambiente.largo} onChange={(largo) => onChange({ largo })} onMedir={() => onMedir('largo')} />
        <NumField label="Ancho (m)" value={ambiente.ancho} onChange={(ancho) => onChange({ ancho })} onMedir={() => onMedir('ancho')} />
      </View>
      <View style={s.dimsRow}>
        <NumField label="Alto (m)" value={ambiente.alto} onChange={(alto) => onChange({ alto })} />
        <View style={s.areaWrap}>
          <Text style={s.areaLabel}>Superficie</Text>
          <Text style={s.areaVal}>{area.toFixed(2)} m²</Text>
        </View>
      </View>

      <TouchableOpacity style={s.fotoBtn} onPress={onFoto}>
        {ambiente.fotoUri ? (
          <Image source={{ uri: ambiente.fotoUri }} style={s.fotoThumb} />
        ) : (
          <View style={s.fotoThumbEmpty}><Text style={s.fotoEmptyTxt}>📷</Text></View>
        )}
        <Text style={s.fotoTxt}>{ambiente.fotoUri ? 'Cambiar foto del recorrido' : 'Tomar foto del recorrido'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card:        { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 12 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  nombre:      { flex: 1, fontFamily: F.bold, fontSize: 15, color: C.white, paddingVertical: 2 },
  del:         { fontFamily: F.bold, fontSize: 16, color: C.textMid, paddingHorizontal: 6 },
  dimsRow:     { flexDirection: 'row', gap: 10, marginBottom: 10 },
  numWrap:     { flex: 1 },
  numLabel:    { fontFamily: F.semi, fontSize: 11, color: C.textMid, marginBottom: 4 },
  numRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn:     { width: 32, height: 38, borderRadius: 8, backgroundColor: C.bgInput, alignItems: 'center', justifyContent: 'center' },
  stepTxt:     { fontFamily: F.bold, fontSize: 16, color: C.text },
  numInput:    { flex: 1, height: 38, backgroundColor: C.bgInput, borderRadius: 8, color: C.white, fontFamily: F.semi, fontSize: 15, textAlign: 'center' },
  medirBtn:    { width: 38, height: 38, borderRadius: 8, backgroundColor: C.redDim, alignItems: 'center', justifyContent: 'center' },
  medirTxt:    { fontSize: 16 },
  areaWrap:    { flex: 1, justifyContent: 'flex-end' },
  areaLabel:   { fontFamily: F.semi, fontSize: 11, color: C.textMid, marginBottom: 4 },
  areaVal:     { fontFamily: F.bold, fontSize: 16, color: C.green, height: 38, lineHeight: 38 },
  fotoBtn:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  fotoThumb:   { width: 44, height: 44, borderRadius: 8 },
  fotoThumbEmpty: { width: 44, height: 44, borderRadius: 8, backgroundColor: C.bgInput, alignItems: 'center', justifyContent: 'center' },
  fotoEmptyTxt:{ fontSize: 18 },
  fotoTxt:     { fontFamily: F.semi, fontSize: 13, color: C.textMid },
});
