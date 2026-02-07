import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X, User, MessageSquare, MapPin, Building2, Hash, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSearch } from '../../hooks/useApi'
import type { SearchResults } from '../../lib/api'

interface SearchBarProps {
  className?: string
  placeholder?: string
  autoFocus?: boolean
  onClose?: () => void
}

export function SearchBar({ className = '', placeholder = 'Hae...', autoFocus = false, onClose }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: results, isLoading } = useSearch(query)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
        onClose?.()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    setIsOpen(value.length >= 2)
  }, [])

  const handleResultClick = useCallback(() => {
    setQuery('')
    setIsOpen(false)
    onClose?.()
  }, [onClose])

  const handleClear = useCallback(() => {
    setQuery('')
    setIsOpen(false)
    inputRef.current?.focus()
  }, [])

  const hasResults = results && (
    results.users.length > 0 ||
    results.threads.length > 0 ||
    results.places.length > 0 ||
    results.municipalities.length > 0 ||
    results.tags.length > 0
  )

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-9 pr-8 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-[70vh] overflow-y-auto z-50">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            </div>
          ) : hasResults ? (
            <SearchResultsList results={results} onResultClick={handleResultClick} />
          ) : query.length >= 2 ? (
            <div className="py-8 text-center text-gray-500 text-sm">
              Ei tuloksia haulle "{query}"
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

interface SearchResultsListProps {
  results: SearchResults
  onResultClick: () => void
}

function SearchResultsList({ results, onResultClick }: SearchResultsListProps) {
  return (
    <div className="py-2">
      {/* Users */}
      {results.users.length > 0 && (
        <ResultSection title="Käyttäjät" icon={User}>
          {results.users.map(user => (
            <Link
              key={user.id}
              to={`/user/${user.id}`}
              onClick={onResultClick}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-medium">
                {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">{user.name}</div>
                <div className="text-xs text-gray-500 truncate">
                  @{user.username}
                  {user.institutionName && ` · ${user.institutionName}`}
                </div>
              </div>
              {user.role === 'institution' && (
                <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">
                  {user.institutionType === 'municipality' ? 'Kunta' : 'Virasto'}
                </span>
              )}
            </Link>
          ))}
        </ResultSection>
      )}

      {/* Municipalities */}
      {results.municipalities.length > 0 && (
        <ResultSection title="Kunnat" icon={Building2}>
          {results.municipalities.map(m => (
            <Link
              key={m.id}
              to={`/kunnat/${m.id}`}
              onClick={onResultClick}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              <Building2 className="w-5 h-5 text-gray-400" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">{m.name}</div>
                {m.region && (
                  <div className="text-xs text-gray-500">{m.region}</div>
                )}
              </div>
            </Link>
          ))}
        </ResultSection>
      )}

      {/* Threads */}
      {results.threads.length > 0 && (
        <ResultSection title="Keskustelut" icon={MessageSquare}>
          {results.threads.map(thread => (
            <Link
              key={thread.id}
              to={`/agora/thread/${thread.id}`}
              onClick={onResultClick}
              className="block px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-gray-900 line-clamp-1">{thread.title}</div>
              <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                <span>{thread.authorName}</span>
                {thread.municipalityName && (
                  <>
                    <span>·</span>
                    <span>{thread.municipalityName}</span>
                  </>
                )}
                <span>·</span>
                <span>{thread.replyCount} vastausta</span>
              </div>
            </Link>
          ))}
        </ResultSection>
      )}

      {/* Places */}
      {results.places.length > 0 && (
        <ResultSection title="Paikat" icon={MapPin}>
          {results.places.map(place => (
            <Link
              key={place.id}
              to={`/kartta?place=${place.id}`}
              onClick={onResultClick}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              <MapPin className="w-5 h-5 text-gray-400" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">{place.name}</div>
                {(place.category || place.municipalityName) && (
                  <div className="text-xs text-gray-500">
                    {place.category}
                    {place.category && place.municipalityName && ' · '}
                    {place.municipalityName}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </ResultSection>
      )}

      {/* Tags */}
      {results.tags.length > 0 && (
        <ResultSection title="Aiheet" icon={Hash}>
          <div className="px-4 py-2 flex flex-wrap gap-2">
            {results.tags.map(tag => (
              <Link
                key={tag.tag}
                to={`/agora?tags=${encodeURIComponent(tag.tag)}`}
                onClick={onResultClick}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
              >
                <Hash className="w-3 h-3" />
                {tag.tag}
                <span className="text-gray-400 text-xs">({tag.count})</span>
              </Link>
            ))}
          </div>
        </ResultSection>
      )}

      {/* Processing time */}
      {results.processingTimeMs && (
        <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
          Haku kesti {results.processingTimeMs}ms
        </div>
      )}
    </div>
  )
}

interface ResultSectionProps {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}

function ResultSection({ title, icon: Icon, children }: ResultSectionProps) {
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div className="px-4 py-1.5 bg-gray-50 flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</span>
      </div>
      {children}
    </div>
  )
}
