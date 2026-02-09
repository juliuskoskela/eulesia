import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useGuide } from '../../hooks/useGuide'
import { guides } from '../../data/guides'

export function GuideHelpButton() {
  const { t } = useTranslation('guide')
  const { startGuide, hasCompletedGuide, isGuideActive } = useGuide()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Hide button while a guide is active
  if (isGuideActive) return null

  const guideEntries = Object.values(guides)

  return (
    <div className="fixed bottom-20 right-4 z-40" ref={menuRef}>
      {/* Menu dropdown */}
      {showMenu && (
        <div className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('selectGuide')}
            </p>
          </div>
          <div className="py-1">
            {guideEntries.map(guide => {
              const completed = hasCompletedGuide(guide.id)
              return (
                <button
                  key={guide.id}
                  onClick={() => {
                    startGuide(guide.id)
                    setShowMenu(false)
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-gray-700">
                    {t(guide.titleKey.replace('guide:', ''))}
                  </span>
                  {completed && (
                    <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                      {t('completed')}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
        aria-label={t('helpButton')}
      >
        <HelpCircle className="w-6 h-6" />
      </button>
    </div>
  )
}
