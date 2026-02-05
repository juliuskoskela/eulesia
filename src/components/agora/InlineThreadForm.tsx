import { useState, useRef, useEffect } from 'react'
import { MapPin, Building2, Globe, Hash, Plus, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { useCreateThread } from '../../hooks/useApi'
import { LocationSearch } from '../common/LocationSearch'
import type { Scope } from '../../types'
import type { LocationResult } from '../../lib/api'

interface InlineThreadFormProps {
  // For municipality pages - prefilled location
  locationId?: string
  locationName?: string
  // Callback when thread is created
  onSuccess: (threadId: string) => void
}

// Common tags for quick selection
const suggestedTags = [
  'liikenne', 'koulutus', 'terveys', 'ympäristö', 'asuminen',
  'kulttuuri', 'talous', 'turvallisuus', 'sosiaalipalvelut', 'infrastruktuuri'
]

const scopeOptions: { value: Scope; icon: React.ElementType; label: string }[] = [
  { value: 'local', icon: MapPin, label: 'Paikallinen' },
  { value: 'national', icon: Building2, label: 'Valtakunnallinen' },
  { value: 'european', icon: Globe, label: 'EU' }
]

export function InlineThreadForm({ locationId, locationName, onSuccess }: InlineThreadFormProps) {
  const createThreadMutation = useCreateThread()
  const formRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Is this a prefilled location context (municipality page)?
  const isPrefilled = !!(locationId && locationName)

  // Form state
  const [isExpanded, setIsExpanded] = useState(false)
  const [scope, setScope] = useState<Scope>(isPrefilled ? 'local' : 'national')
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [customTag, setCustomTag] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Focus title input when expanded
  useEffect(() => {
    if (isExpanded && titleInputRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => titleInputRef.current?.focus(), 50)
    }
  }, [isExpanded])

  // Clear location when switching away from local scope
  useEffect(() => {
    if (scope !== 'local') {
      setSelectedLocation(null)
    }
  }, [scope])

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const handleAddCustomTag = () => {
    const tag = customTag.trim().toLowerCase()
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags(prev => [...prev, tag])
      setCustomTag('')
    }
  }

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Otsikko ja sisältö ovat pakollisia')
      return
    }

    if (scope === 'local' && !isPrefilled && !selectedLocation) {
      setError('Valitse sijainti paikalliselle keskustelulle')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Build location data
      let locationData = {}
      if (isPrefilled && locationId) {
        locationData = { locationId }
      } else if (scope === 'local' && selectedLocation) {
        locationData = selectedLocation.status === 'active' && selectedLocation.id
          ? { locationId: selectedLocation.id }
          : { locationOsmId: selectedLocation.osmId, locationOsmType: selectedLocation.osmType }
      }

      const result = await createThreadMutation.mutateAsync({
        title: title.trim(),
        content: content.trim(),
        scope,
        country: 'FI',
        ...locationData,
        tags: selectedTags.length > 0 ? selectedTags : undefined
      })

      // Reset form
      setTitle('')
      setContent('')
      setSelectedTags([])
      setSelectedLocation(null)
      setScope(isPrefilled ? 'local' : 'national')
      setIsExpanded(false)

      onSuccess(result.id)
    } catch (err) {
      setError('Keskustelun luominen epäonnistui. Yritä uudelleen.')
      console.error('Failed to create thread:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setTitle('')
    setContent('')
    setSelectedTags([])
    setSelectedLocation(null)
    setScope(isPrefilled ? 'local' : 'national')
    setError(null)
    setIsExpanded(false)
  }

  return (
    <div ref={formRef} className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all">
      {/* Collapsed state */}
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-blue-50/50 transition-colors group"
        >
          <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
            <Plus className="w-4 h-4 text-blue-600" />
          </div>
          <span className="flex-1 text-gray-500 group-hover:text-gray-700 transition-colors">Aloita uusi keskustelu...</span>
        </button>
      ) : (
        /* Expanded state */
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            {isPrefilled ? (
              // Show location badge when prefilled
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">{locationName}</span>
              </div>
            ) : (
              // Show scope tabs when not prefilled
              <div className="flex items-center gap-2">
                {scopeOptions.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setScope(value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      scope === value
                        ? 'bg-blue-800 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={handleCancel}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronUp className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Location search for local scope (when not prefilled) */}
          {!isPrefilled && scope === 'local' && (
            <LocationSearch
              value={selectedLocation}
              onChange={setSelectedLocation}
              country="FI"
              types={['municipality', 'village', 'city']}
              placeholder="Hae kuntaa, kaupunkia tai kylää..."
            />
          )}

          {/* National/EU indicator - subtle, informational */}
          {!isPrefilled && scope === 'national' && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>🇫🇮</span>
              <span>Näkyy koko Suomessa</span>
            </div>
          )}
          {!isPrefilled && scope === 'european' && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>🇪🇺</span>
              <span>Euroopan laajuinen keskustelu</span>
            </div>
          )}

          {/* Title */}
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Otsikko"
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-base font-medium placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
            maxLength={500}
          />

          {/* Content */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Kerro tarkemmin aiheesta..."
            rows={4}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white resize-none transition-colors"
          />

          {/* Tags */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {suggestedTags.slice(0, 6).map(tag => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Hash className="w-3 h-3" />
                  {tag}
                </button>
              ))}
              {/* Custom tag input inline */}
              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 rounded-full">
                <Hash className="w-3 h-3 text-gray-400" />
                <input
                  type="text"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomTag())}
                  placeholder="muu..."
                  className="w-16 bg-transparent border-0 p-0 text-xs focus:ring-0 focus:outline-none"
                />
              </div>
            </div>
            {/* Selected custom tags */}
            {selectedTags.filter(t => !suggestedTags.includes(t)).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedTags.filter(t => !suggestedTags.includes(t)).map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-600 text-white rounded-full text-xs"
                  >
                    <Hash className="w-3 h-3" />
                    {tag}
                    <button
                      onClick={() => handleTagToggle(tag)}
                      className="hover:bg-teal-700 rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors"
            >
              Peruuta
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || !content.trim() || isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Julkaistaan...' : 'Julkaise'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
