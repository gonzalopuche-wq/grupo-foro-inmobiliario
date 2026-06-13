import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { C, F } from '../lib/theme';

interface Props {
  visible: boolean;
  ambiente: string;
  onClose: () => void;
  onCapture: (foto: { uri: string; base64: string }) => void;
}

// Cámara para tomar la foto del ambiente durante el recorrido. La imagen se
// reescala a 1024px y se comprime antes de devolver el base64 (para la IA).
export default function CamaraFoto({ visible, ambiente, onClose, onCapture }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const ref = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);

  const capturar = async () => {
    if (!ref.current || busy) return;
    setBusy(true);
    try {
      const shot = await ref.current.takePictureAsync({ quality: 0.7 });
      if (!shot?.uri) throw new Error('sin imagen');
      const manip = await ImageManipulator.manipulateAsync(
        shot.uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.6, base64: true, format: ImageManipulator.SaveFormat.JPEG },
      );
      onCapture({ uri: manip.uri, base64: manip.base64 ?? '' });
    } catch {
      // silencioso: el usuario puede reintentar
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        {!permission?.granted ? (
          <View style={s.perm}>
            <Text style={s.permTxt}>Necesitamos acceso a la cámara para tomar la foto del ambiente.</Text>
            <TouchableOpacity style={s.btn} onPress={requestPermission}>
              <Text style={s.btnTxt}>Dar permiso</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ marginTop: 16 }}>
              <Text style={s.cancel}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView ref={ref} style={StyleSheet.absoluteFill} facing="back" />
            <View style={s.topBar}>
              <Text style={s.topTxt}>Foto · {ambiente}</Text>
            </View>
            <View style={s.bottomBar}>
              <TouchableOpacity onPress={onClose} style={s.sideBtn}>
                <Text style={s.sideTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.shutter, busy && { opacity: 0.5 }]} onPress={capturar} disabled={busy}>
                {busy ? <ActivityIndicator color="#000" /> : <View style={s.shutterInner} />}
              </TouchableOpacity>
              <View style={s.sideBtn} />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#000' },
  perm:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: C.bg },
  permTxt:    { fontFamily: F.body, fontSize: 14, color: C.text, textAlign: 'center', marginBottom: 20 },
  btn:        { backgroundColor: C.red, borderRadius: 8, paddingVertical: 14, paddingHorizontal: 28 },
  btnTxt:     { fontFamily: F.bold, color: '#fff', fontSize: 14 },
  cancel:     { fontFamily: F.body, color: C.textMid, fontSize: 13 },
  topBar:     { position: 'absolute', top: 50, left: 0, right: 0, alignItems: 'center' },
  topTxt:     { fontFamily: F.bold, color: '#fff', fontSize: 14, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  bottomBar:  { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30 },
  sideBtn:    { width: 80 },
  sideTxt:    { fontFamily: F.semi, color: '#fff', fontSize: 14 },
  shutter:    { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
});
