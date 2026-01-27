import { useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { EulesiaMap, LocationDetails } from '../components/map'
import type { MapPoint } from '../lib/api'

export function MapPage() {
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null)

  const handlePointClick = (point: MapPoint) => {
    setSelectedPoint(point)
  }

  const handleCloseDetails = () => {
    setSelectedPoint(null)
  }

  return (
    <Layout fullWidth showFooter={false}>
      <div className="fixed inset-0 top-14 bottom-16">
        <EulesiaMap onPointClick={handlePointClick} />

        {selectedPoint && (
          <LocationDetails
            point={selectedPoint}
            onClose={handleCloseDetails}
          />
        )}
      </div>
    </Layout>
  )
}
