import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { FileText, ArrowLeft } from 'lucide-react'
import { Layout } from '../components/layout'
import { useAuth } from '../hooks/useAuth'

function PublicHeader() {
  return (
    <div className="bg-blue-900 text-white py-4 px-4">
      <div className="max-w-4xl mx-auto flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <span className="text-blue-800 font-bold text-lg">E</span>
          </div>
          <span className="font-bold text-lg">Eulesia</span>
        </Link>
      </div>
    </div>
  )
}

function TermsContent() {
  const { t } = useTranslation('legal')

  const sectionKeys = [
    'intro', 'service', 'account', 'conduct', 'content',
    'moderation', 'privacy', 'liability', 'changes', 'termination', 'law', 'contact'
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Link to="/about" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-4">
        <ArrowLeft className="w-4 h-4" />
        {t('common:actions.back')}
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            {t('terms.title')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('terms.lastUpdated', { date: '12.2.2026' })}
          </p>
        </div>

        <div className="p-6 space-y-6">
          {sectionKeys.map((key) => (
            <section key={key}>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                {t(`terms.sections.${key}.title`)}
              </h2>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {t(`terms.sections.${key}.content`)}
              </p>
              {key === 'conduct' && (
                <ul className="mt-2 space-y-1">
                  {(t(`terms.sections.conduct.rules`, { returnObjects: true }) as string[]).map((rule, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      {rule}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link to="/privacy" className="text-sm text-blue-600 hover:underline">
          {t('privacy.title')} →
        </Link>
      </div>
    </div>
  )
}

export function TermsPage() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicHeader />
        <TermsContent />
      </div>
    )
  }

  return (
    <Layout>
      <TermsContent />
    </Layout>
  )
}
