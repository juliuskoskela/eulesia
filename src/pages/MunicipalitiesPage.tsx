import { MapPin, MessageSquare, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/layout'
import { useMunicipalities, useThreads } from '../hooks/useApi'
import type { Municipality } from '../lib/api'

export function MunicipalitiesPage() {
  const { data: municipalities, isLoading, error } = useMunicipalities()
  const { data: threadsData } = useThreads({ scope: 'local' })

  // Count threads per municipality
  const threadCounts = new Map<string, number>()
  if (threadsData?.items) {
    for (const thread of threadsData.items) {
      if (thread.municipality?.id) {
        const count = threadCounts.get(thread.municipality.id) || 0
        threadCounts.set(thread.municipality.id, count + 1)
      }
    }
  }

  // Filter to municipalities with threads and sort by thread count
  const municipalitiesWithThreads = municipalities
    ?.filter((m: Municipality) => threadCounts.has(m.id))
    .sort((a: Municipality, b: Municipality) => {
      const countA = threadCounts.get(a.id) || 0
      const countB = threadCounts.get(b.id) || 0
      return countB - countA
    })

  return (
    <Layout>
      {/* Page header */}
      <div className="bg-white px-4 py-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kunnat</h1>
          <p className="text-sm text-gray-600 mt-1">
            Kuntakohtaiset keskustelut ja pöytäkirjayhteenvedot
          </p>
        </div>
      </div>

      {/* Municipality list */}
      <div className="px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-600">
            <p>Kuntien lataaminen epäonnistui</p>
            <p className="text-sm mt-1">{error instanceof Error ? error.message : 'Tuntematon virhe'}</p>
          </div>
        )}

        {!isLoading && !error && municipalitiesWithThreads && municipalitiesWithThreads.length > 0 && (
          <div className="space-y-3">
            {municipalitiesWithThreads.map((municipality: Municipality) => (
              <MunicipalityCard
                key={municipality.id}
                municipality={municipality}
                threadCount={threadCounts.get(municipality.id) || 0}
              />
            ))}
          </div>
        )}

        {!isLoading && !error && (!municipalitiesWithThreads || municipalitiesWithThreads.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Ei vielä kuntakohtaisia keskusteluja</p>
          </div>
        )}
      </div>
    </Layout>
  )
}

interface MunicipalityCardProps {
  municipality: Municipality
  threadCount: number
}

function MunicipalityCard({ municipality, threadCount }: MunicipalityCardProps) {
  return (
    <Link
      to={`/kunnat/${municipality.id}`}
      className="block bg-white rounded-xl p-4 hover:shadow-md transition-shadow border border-gray-200"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <MapPin className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{municipality.name}</h3>
            {municipality.region && (
              <p className="text-sm text-gray-500">{municipality.region}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <MessageSquare className="w-4 h-4" />
            <span>{threadCount}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </Link>
  )
}
