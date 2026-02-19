import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Layout } from '../components/layout/Layout'
import { SEOHead } from '../components/SEOHead'
import { EulesiaMap, LocationDetails } from '../components/map'
import { useGuide } from '../hooks/useGuide'
import type { MapPoint } from '../lib/api'
import { DEFAULT_FILTERS, type MapFilterState } from '../components/map/types'

export function MapPage() {
  const { t: _t } = useTranslation('map')
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null)
  const [filters, setFilters] = useState<MapFilterState>(DEFAULT_FILTERS)
  const { hasCompletedGuide, startGuide, isGuideActive } = useGuide()

  // Auto-trigger map guide on first visit
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasCompletedGuide('map') && !isGuideActive) {
        startGuide('map')
      }
    }, 800)
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePointClick = (point: MapPoint) => {
    setSelectedPoint(point)
  }

  const handleCloseDetails = () => {
    setSelectedPoint(null)
  }

  return (
    <Layout fullWidth showFooter={false}>
      <SEOHead title="Kartta" path="/map" noIndex />
      <div className="fixed inset-0 bottom-16 z-0" style={{ top: 'var(--topbar-total)' }} data-guide="map-header">
        <EulesiaMap
          filters={filters}
          onFiltersChange={setFilters}
          onPointClick={handlePointClick}
        />

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
