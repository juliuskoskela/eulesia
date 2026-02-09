import { useContext } from 'react'
import { GuideContext, type GuideContextType } from '../components/guide/GuideProvider'

export function useGuide(): GuideContextType {
  const context = useContext(GuideContext)
  if (!context) {
    throw new Error('useGuide must be used within a GuideProvider')
  }
  return context
}
