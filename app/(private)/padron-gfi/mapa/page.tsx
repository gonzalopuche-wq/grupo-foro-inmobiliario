'use client'

import dynamic from 'next/dynamic'

const MapaPadron = dynamic(() => import('./MapaPadron'), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter,sans-serif', fontSize: 13 }}>
      Cargando mapa…
    </div>
  ),
})

export default function MapaPadronPage() {
  return <MapaPadron />
}
