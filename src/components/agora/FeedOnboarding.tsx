import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Hash, Building2, CheckCircle2, Loader2, ChevronRight } from 'lucide-react'
import { useSubscribe, useMunicipalities, useTags } from '../../hooks/useApi'
import type { Municipality, TagWithCategory } from '../../lib/api'

interface FeedOnboardingProps {
  onComplete: () => void
}

function groupTagsByCategory(tags: TagWithCategory[]): Record<string, TagWithCategory[]> {
  const groups: Record<string, TagWithCategory[]> = {}
  for (const tag of tags) {
    const category = tag.category || 'muut'
    if (!groups[category]) groups[category] = []
    groups[category].push(tag)
  }
  return groups
}

export function FeedOnboarding({ onComplete }: FeedOnboardingProps) {
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: municipalitiesData } = useMunicipalities()
  const { data: tagsData } = useTags()
  const subscribeMutation = useSubscribe()

  const topMunicipalities = (municipalitiesData || []).slice(0, 8)

  // Group tags by category, show top tags from each category
  const allTags = tagsData || []
  const grouped = groupTagsByCategory(allTags)
  const categories = Object.keys(grouped).filter(c => c !== 'muut')

  // Show top 2-3 tags per category for compact onboarding
  const featuredTags: TagWithCategory[] = []
  for (const category of categories) {
    const categoryTags = grouped[category] || []
    // Take tags with highest count or first by sort order
    const sorted = [...categoryTags].sort((a, b) => (b.count || 0) - (a.count || 0))
    featuredTags.push(...sorted.slice(0, 2))
  }

  const toggleMunicipality = (id: string) => {
    setSelectedMunicipalities(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      // Subscribe to selected municipalities
      for (const municipalityId of selectedMunicipalities) {
        await subscribeMutation.mutateAsync({
          entityType: 'municipality',
          entityId: municipalityId
        })
      }

      // Subscribe to selected tags
      for (const tag of selectedTags) {
        await subscribeMutation.mutateAsync({
          entityType: 'tag',
          entityId: tag
        })
      }

      onComplete()
    } catch (error) {
      console.error('Failed to save subscriptions:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasSelections = selectedMunicipalities.length > 0 || selectedTags.length > 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Tervetuloa Agoraan!
        </h2>
        <p className="text-gray-600">
          Feedisi on tyhjä. Aloita seuraamalla paikkakuntia ja aiheita, jotka kiinnostavat sinua.
        </p>
      </div>

      {/* Municipalities */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Paikkakunnat</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {topMunicipalities.map((m: Municipality) => (
            <button
              key={m.id}
              onClick={() => toggleMunicipality(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedMunicipalities.includes(m.id)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {selectedMunicipalities.includes(m.id) && (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tags by category */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-teal-600" />
            <h3 className="font-semibold text-gray-900">Aiheet</h3>
          </div>
          <Link
            to="/aiheet"
            className="text-xs text-teal-600 hover:underline flex items-center gap-0.5"
          >
            Kaikki aiheet
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Featured tags from each category */}
        <div className="flex flex-wrap gap-2">
          {featuredTags.map(tag => (
            <button
              key={tag.tag}
              onClick={() => toggleTag(tag.tag)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedTags.includes(tag.tag)
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {selectedTags.includes(tag.tag) && (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {tag.displayName || tag.tag.replace(/-/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Organizations hint */}
      <div className="mb-6 p-3 bg-violet-50 rounded-lg">
        <div className="flex items-start gap-2">
          <Building2 className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-violet-700">
            Voit myös seurata instituutioita ja organisaatioita heidän profiilisivuiltaan —
            seuraa virallisia julkaisuja tai topicia erikseen.
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={onComplete}
          className="flex-1 px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
        >
          Ohita
        </button>
        <button
          onClick={handleSubmit}
          disabled={!hasSelections || isSubmitting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Tallennetaan...
            </>
          ) : (
            'Valmis'
          )}
        </button>
      </div>
    </div>
  )
}
