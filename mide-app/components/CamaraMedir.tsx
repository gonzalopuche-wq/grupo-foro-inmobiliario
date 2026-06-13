import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { DeviceMotion } from 'expo-sensors';
import { C, F } from '../lib/theme';
import {
  ALTURA_DISPOSITIVO_DEFAULT, depresionDesdePitch, distanciaPiso, radToDeg,
} from '../lib/clinometer';

interface Props {
  visible: boolean;
  objetivo: string; // ej. "largo del Living"
  onClose: () => void;
  onMedida: (metros: number) => void;
}

// Medición asistida con la cámara (clinómetro). El corredor se para contra una
// pared, apunta a la base de la pared de enfrente y la app estima la distancia
// horizontal con el ángulo de la cámara + la altura a la que sostiene el teléfono.
// Siempre se puede ajustar la medida a mano después.
export default function CamaraMedir({ visible, objetivo, onClose, onMedida }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [altura, setAltura] = useState(ALTURA_DISPOSITIVO_DEFAULT);
  const [depresion, setDepresion] = useState(0);
  const [dist, setDist] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    DeviceMotion.setUpdateInterval(120);
    const sub = DeviceMotion.addListener((d) => {
      const pitch = d.rotation?.beta ?? 0;
      const dep = depresionDesdePitch(pitch);
      setDepresion(dep);
      setDist(distanciaPiso(dep, altura));
    });
    return () => sub.remove();
  }, [visible, altura]);

  const ajustarAltura = (delta: number) =>
    setAltura((a) => Math.min(2.2, Math.max(0.3, Math.round((a + delta) * 100) / 100)));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        {!permission?.granted ? (
          <View style={s.perm}>
            <Text style={s.permTxt}>Necesitamos la cámara y los sensores para medir.</Text>
            <TouchableOpacity style={s.btn} onPress={requestPermission}>
              <Text style={s.btnTxt}>Dar permiso</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ marginTop: 16 }}>
              <Text style={s.cancel}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView style={StyleSheet.absoluteFill} facing="back" />
            {/* mira / crosshair */}
            <View pointerEvents="none" style={s.crosshairWrap}>
              <View style={s.crossH} />
              <View style={s.crossV} />
            </View>

            <View style={s.topBar}>
              <Text style={s.topTxt}>Medí el {objetivo}</Text>
              <Text style={s.hint}>Apuntá a la base de la pared de enfrente</Text>
            </View>

            <View style={s.readout}>
              <Text style={s.distVal}>{dist != null ? `${dist.toFixed(2)} m` : '—'}</Text>
              <Text style={s.distSub}>
                ángulo {radToDeg(depresion).toFixed(0)}° · teléfono a {altura.toFixed(2)} m
              </Text>
              <View style={s.alturaRow}>
                <Text style={s.alturaLbl}>Altura del teléfono</Text>
                <TouchableOpacity style={s.alturaBtn} onPress={() => ajustarAltura(-0.1)}><Text style={s.alturaBtnTxt}>−</Text></TouchableOpacity>
                <TouchableOpacity style={s.alturaBtn} onPress={() => ajustarAltura(0.1)}><Text style={s.alturaBtnTxt}>＋</Text></TouchableOpacity>
              </View>
            </View>

            <View style={s.bottomBar}>
              <TouchableOpacity onPress={onClose} style={s.sideBtn}>
                <Text style={s.sideTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.usar, dist == null && { opacity: 0.4 }]}
                onPress={() => dist != null && onMedida(Math.round(dist * 100) / 100)}
                disabled={dist == null}
              >
                <Text style={s.usarTxt}>Usar medida</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#000' },
  perm:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: C.bg },
  permTxt:     { fontFamily: F.body, fontSize: 14, color: C.text, textAlign: 'center', marginBottom: 20 },
  btn:         { backgroundColor: C.red, borderRadius: 8, paddingVertical: 14, paddingHorizontal: 28 },
  btnTxt:      { fontFamily: F.bold, color: '#fff', fontSize: 14 },
  cancel:      { fontFamily: F.body, color: C.textMid, fontSize: 13 },
  crosshairWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  crossH:      { position: 'absolute', width: 44, height: 2, backgroundColor: C.red },
  crossV:      { position: 'absolute', width: 2, height: 44, backgroundColor: C.red },
  topBar:      { position: 'absolute', top: 50, left: 0, right: 0, alignItems: 'center' },
  topTxt:      { fontFamily: F.bold, color: '#fff', fontSize: 15, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  hint:        { fontFamily: F.body, color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 6 },
  readout:     { position: 'absolute', bottom: 130, left: 0, right: 0, alignItems: 'center' },
  distVal:     { fontFamily: F.heading, color: '#fff', fontSize: 44, textShadowColor: '#000', textShadowRadius: 6 },
  distSub:     { fontFamily: F.body, color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  alturaRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  alturaLbl:   { fontFamily: F.semi, color: '#fff', fontSize: 12, marginRight: 4 },
  alturaBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  alturaBtnTxt:{ fontFamily: F.bold, color: '#fff', fontSize: 18 },
  bottomBar:   { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30 },
  sideBtn:     { width: 90 },
  sideTxt:     { fontFamily: F.semi, color: '#fff', fontSize: 14 },
  usar:        { backgroundColor: C.red, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 28 },
  usarTxt:     { fontFamily: F.bold, color: '#fff', fontSize: 15 },
});
