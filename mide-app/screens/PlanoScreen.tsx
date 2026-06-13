import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { C, F } from '../lib/theme';
import { useRelevamientos } from '../state/relevamiento';
import { armarPlano } from '../lib/geometry';
import { areaAmbiente, superficieTotal } from '../lib/types';

export default function PlanoScreen() {
  const { current } = useRelevamientos();
  const { width } = useWindowDimensions();

  const ambientes = current?.ambientes ?? [];
  const layout = useMemo(() => armarPlano(ambientes), [ambientes]);

  if (!current || ambientes.length === 0) {
    return <View style={s.center}><Text style={s.emptyTxt}>No hay ambientes para dibujar.</Text></View>;
  }

  const PAD = 24;
  const svgW = width - PAD * 2;
  const escala = svgW / layout.ancho; // px por metro
  const svgH = layout.alto * escala;
  const total = superficieTotal(ambientes);

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: PAD }}>
      <Text style={s.titulo}>{current.titulo}</Text>
      <Text style={s.sub}>{ambientes.length} ambientes · {total.toFixed(1)} m² · escala 1:{Math.round(100 / escala)} aprox.</Text>

      <View style={s.planoWrap}>
        <Svg width={svgW} height={svgH}>
          {layout.bloques.map(({ ambiente, x, y, w, h }) => {
            const px = x * escala, py = y * escala, pw = w * escala, ph = h * escala;
            const area = areaAmbiente(ambiente);
            return (
              <React.Fragment key={ambiente.id}>
                <Rect
                  x={px} y={py} width={pw} height={ph}
                  fill="rgba(58,186,182,0.10)" stroke={C.green} strokeWidth={2} rx={2}
                />
                <SvgText
                  x={px + pw / 2} y={py + ph / 2 - 2}
                  fill="#fff" fontSize={Math.min(13, pw / 6)} fontWeight="bold" textAnchor="middle"
                >
                  {ambiente.nombre}
                </SvgText>
                <SvgText
                  x={px + pw / 2} y={py + ph / 2 + 14}
                  fill="rgba(255,255,255,0.6)" fontSize={Math.min(11, pw / 7)} textAnchor="middle"
                >
                  {`${w.toFixed(1)}×${h.toFixed(1)} · ${area.toFixed(1)}m²`}
                </SvgText>
              </React.Fragment>
            );
          })}
          {/* barra de escala = 1 m */}
          <Line x1={0} y1={svgH - 1} x2={escala} y2={svgH - 1} stroke={C.red} strokeWidth={3} />
        </Svg>
      </View>

      <Text style={s.nota}>
        Plano esquemático: cada ambiente está a escala real según las medidas cargadas. La barra roja equivale a 1 metro.
        La disposición es indicativa (no refleja la posición exacta entre ambientes).
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  center:    { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  emptyTxt:  { fontFamily: F.body, fontSize: 14, color: C.textMid },
  titulo:    { fontFamily: F.bold, fontSize: 18, color: C.white },
  sub:       { fontFamily: F.body, fontSize: 12, color: C.textMid, marginTop: 4, marginBottom: 16 },
  planoWrap: { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 8 },
  nota:      { fontFamily: F.body, fontSize: 12, color: C.textDim, marginTop: 16, lineHeight: 18 },
});
