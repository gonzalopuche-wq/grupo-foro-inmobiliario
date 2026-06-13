import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, PanResponder, TouchableOpacity } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { C, F } from '../lib/theme';
import { useRelevamientos } from '../state/relevamiento';
import { armarPlano } from '../lib/geometry';

export default function Tour3DScreen() {
  const { current } = useRelevamientos();
  const ambientes = current?.ambientes ?? [];

  // Parámetros de cámara orbital (refs: no re-render por frame).
  const theta = useRef(Math.PI / 4);
  const phi = useRef(Math.PI / 3);
  const radius = useRef(14);
  const last = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => { last.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }; },
      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        const dx = x - last.current.x;
        const dy = y - last.current.y;
        last.current = { x, y };
        theta.current -= dx * 0.01;
        phi.current = Math.min(Math.PI / 2 - 0.05, Math.max(0.15, phi.current - dy * 0.01));
      },
    }),
  ).current;

  const zoom = (factor: number) => {
    radius.current = Math.min(40, Math.max(3, radius.current * factor));
  };

  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  if (!current || ambientes.length === 0) {
    return <View style={s.center}><Text style={s.emptyTxt}>No hay ambientes para mostrar en 3D.</Text></View>;
  }

  const onContextCreate = async (gl: import('expo-gl').ExpoWebGLRenderingContext) => {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;

    const renderer = new Renderer({ gl });
    renderer.setSize(w, h);
    renderer.setClearColor(0x0a0a0a, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(6, 12, 8);
    scene.add(dir);

    const layout = armarPlano(ambientes);
    const cx = layout.ancho / 2;
    const cz = layout.alto / 2;
    const target = new THREE.Vector3(0, 1, 0);

    const pisoMat = new THREE.MeshStandardMaterial({ color: 0x14302f, side: THREE.DoubleSide });
    const paredMat = new THREE.MeshStandardMaterial({ color: 0x3abab6, transparent: true, opacity: 0.5 });
    const T = 0.08; // espesor de pared

    for (const { ambiente, x, y, w: bw, h: bh } of layout.bloques) {
      const alto = ambiente.alto || 2.6;
      // Origen del bloque centrado en el conjunto.
      const ox = x - cx;
      const oz = y - cz;
      const midX = ox + bw / 2;
      const midZ = oz + bh / 2;

      // Piso
      const piso = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), pisoMat);
      piso.rotation.x = -Math.PI / 2;
      piso.position.set(midX, 0, midZ);
      scene.add(piso);

      // 4 paredes (cajas finas)
      const paredLargoFrente = new THREE.Mesh(new THREE.BoxGeometry(bw, alto, T), paredMat);
      paredLargoFrente.position.set(midX, alto / 2, oz);
      scene.add(paredLargoFrente);

      const paredLargoFondo = new THREE.Mesh(new THREE.BoxGeometry(bw, alto, T), paredMat);
      paredLargoFondo.position.set(midX, alto / 2, oz + bh);
      scene.add(paredLargoFondo);

      const paredLatIzq = new THREE.Mesh(new THREE.BoxGeometry(T, alto, bh), paredMat);
      paredLatIzq.position.set(ox, alto / 2, midZ);
      scene.add(paredLatIzq);

      const paredLatDer = new THREE.Mesh(new THREE.BoxGeometry(T, alto, bh), paredMat);
      paredLatDer.position.set(ox + bw, alto / 2, midZ);
      scene.add(paredLatDer);
    }

    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      const r = radius.current;
      const sinPhi = Math.sin(phi.current);
      camera.position.set(
        target.x + r * sinPhi * Math.cos(theta.current),
        target.y + r * Math.cos(phi.current),
        target.z + r * sinPhi * Math.sin(theta.current),
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();
  };

  return (
    <View style={s.root}>
      <View style={s.glWrap} {...pan.panHandlers}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      </View>

      <View style={s.controls}>
        <TouchableOpacity style={s.zoomBtn} onPress={() => zoom(0.85)}><Text style={s.zoomTxt}>＋</Text></TouchableOpacity>
        <TouchableOpacity style={s.zoomBtn} onPress={() => zoom(1.18)}><Text style={s.zoomTxt}>−</Text></TouchableOpacity>
      </View>

      <View style={s.hintWrap}>
        <Text style={s.hint}>Arrastrá para girar · ＋ / − para acercar</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.bg },
  center:   { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { fontFamily: F.body, fontSize: 14, color: C.textMid },
  glWrap:   { flex: 1 },
  controls: { position: 'absolute', right: 16, bottom: 70, gap: 10 },
  zoomBtn:  { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  zoomTxt:  { fontFamily: F.bold, fontSize: 22, color: '#fff' },
  hintWrap: { position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center' },
  hint:     { fontFamily: F.body, fontSize: 12, color: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
});
