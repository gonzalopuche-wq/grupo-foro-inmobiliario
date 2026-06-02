'use client'

import dynamic from 'next/dynamic'

const MapaRedGFI = dynamic(() => import('./MapaRedGFI'), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gfi-text-muted)', fontFamily: 'Inter,sans-serif', fontSize: 13 }}>
      Cargando mapa…
    </div>
  ),
})

export default function MapaRedGFIPage() {
  return <MapaRedGFI />
}
