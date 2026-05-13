import dynamic from 'next/dynamic'

const MapaPadron = dynamic(() => import('./MapaPadron'), { ssr: false })

export default function MapaPadronPage() {
  return <MapaPadron />
}
