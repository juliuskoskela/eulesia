import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { guides } from '../../data/guides'

const STORAGE_KEY = 'eulesia_guides_completed'

export interface GuideContextType {
  completedGuides: Record<string, boolean>
  activeGuideId: string | null
  activeStepIndex: number
  isGuideActive: boolean
  startGuide: (guideId: string) => void
  nextStep: () => void
  prevStep: () => void
  skipGuide: () => void
  completeGuide: () => void
  resetGuide: (guideId: string) => void
  resetAllGuides: () => void
  hasCompletedGuide: (guideId: string) => boolean
}

export const GuideContext = createContext<GuideContextType | null>(null)

function loadCompletedGuides(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveCompletedGuides(completed: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed))
  } catch {
    // localStorage may be unavailable
  }
}

export function GuideProvider({ children }: { children: ReactNode }) {
  const [completedGuides, setCompletedGuides] = useState<Record<string, boolean>>(loadCompletedGuides)
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null)
  const [activeStepIndex, setActiveStepIndex] = useState(0)

  const isGuideActive = activeGuideId !== null

  // Persist completed guides
  useEffect(() => {
    saveCompletedGuides(completedGuides)
  }, [completedGuides])

  const startGuide = useCallback((guideId: string) => {
    if (guides[guideId]) {
      setActiveGuideId(guideId)
      setActiveStepIndex(0)
    }
  }, [])

  const completeGuide = useCallback(() => {
    if (activeGuideId) {
      setCompletedGuides(prev => ({ ...prev, [activeGuideId]: true }))
      setActiveGuideId(null)
      setActiveStepIndex(0)
    }
  }, [activeGuideId])

  const nextStep = useCallback(() => {
    if (!activeGuideId) return
    const guide = guides[activeGuideId]
    if (!guide) return

    if (activeStepIndex < guide.steps.length - 1) {
      setActiveStepIndex(prev => prev + 1)
    } else {
      completeGuide()
    }
  }, [activeGuideId, activeStepIndex, completeGuide])

  const prevStep = useCallback(() => {
    if (activeStepIndex > 0) {
      setActiveStepIndex(prev => prev - 1)
    }
  }, [activeStepIndex])

  const skipGuide = useCallback(() => {
    if (activeGuideId) {
      setCompletedGuides(prev => ({ ...prev, [activeGuideId]: true }))
      setActiveGuideId(null)
      setActiveStepIndex(0)
    }
  }, [activeGuideId])

  const resetGuide = useCallback((guideId: string) => {
    setCompletedGuides(prev => {
      const next = { ...prev }
      delete next[guideId]
      return next
    })
  }, [])

  const resetAllGuides = useCallback(() => {
    setCompletedGuides({})
  }, [])

  const hasCompletedGuide = useCallback((guideId: string) => {
    return !!completedGuides[guideId]
  }, [completedGuides])

  return (
    <GuideContext.Provider
      value={{
        completedGuides,
        activeGuideId,
        activeStepIndex,
        isGuideActive,
        startGuide,
        nextStep,
        prevStep,
        skipGuide,
        completeGuide,
        resetGuide,
        resetAllGuides,
        hasCompletedGuide
      }}
    >
      {children}
    </GuideContext.Provider>
  )
}
