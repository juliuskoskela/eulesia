import { FileText, Calendar, HelpCircle, Mail, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { InstitutionalContext } from '../../types'

interface InstitutionalContextBoxProps {
  context: InstitutionalContext
}

export function InstitutionalContextBox({ context }: InstitutionalContextBoxProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('timeline')

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section)
  }

  const docs = context.docs || []
  const timeline = context.timeline || []
  const faq = context.faq || []

  return (
    <div className="bg-violet-50 border border-violet-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-violet-100 border-b border-violet-200">
        <h3 className="font-semibold text-violet-900 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Official Information
        </h3>
        <p className="text-xs text-violet-700 mt-0.5">
          Provided by the institution for this discussion
        </p>
      </div>

      <div className="divide-y divide-violet-200">
        {/* Documents */}
        {docs.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('docs')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-violet-100/50 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium text-violet-900">
                <FileText className="w-4 h-4" />
                Related Documents ({docs.length})
              </span>
              {expandedSection === 'docs' ? (
                <ChevronUp className="w-4 h-4 text-violet-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-violet-600" />
              )}
            </button>

            {expandedSection === 'docs' && (
              <div className="px-4 pb-3 space-y-2">
                {docs.map((doc, i) => (
                  <a
                    key={i}
                    href={doc.url}
                    className="flex items-center gap-2 p-2 bg-white rounded-lg text-sm text-violet-700 hover:bg-violet-100 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    {doc.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('timeline')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-violet-100/50 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium text-violet-900">
                <Calendar className="w-4 h-4" />
                Timeline
              </span>
              {expandedSection === 'timeline' ? (
                <ChevronUp className="w-4 h-4 text-violet-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-violet-600" />
              )}
            </button>

            {expandedSection === 'timeline' && (
              <div className="px-4 pb-3">
                <div className="space-y-3">
                  {timeline.map((item, i) => {
                    const date = new Date(item.date)
                    const isPast = date < new Date()
                    const isNext = !isPast && (i === 0 || new Date(timeline[i - 1].date) < new Date())

                    return (
                      <div
                        key={i}
                        className={`flex gap-3 ${isPast ? 'opacity-60' : ''}`}
                      >
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full ${
                            isPast ? 'bg-gray-400' : isNext ? 'bg-violet-600' : 'bg-violet-300'
                          }`} />
                          {i < timeline.length - 1 && (
                            <div className="w-0.5 h-full bg-violet-200 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <p className="text-xs text-violet-600 font-medium">
                            {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-sm text-violet-900">{item.event}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* FAQ */}
        {faq.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('faq')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-violet-100/50 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium text-violet-900">
                <HelpCircle className="w-4 h-4" />
                FAQ ({faq.length})
              </span>
              {expandedSection === 'faq' ? (
                <ChevronUp className="w-4 h-4 text-violet-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-violet-600" />
              )}
            </button>

            {expandedSection === 'faq' && (
              <div className="px-4 pb-3 space-y-3">
                {faq.map((item, i) => (
                  <div key={i} className="bg-white rounded-lg p-3">
                    <p className="text-sm font-medium text-violet-900 mb-1">{item.q}</p>
                    <p className="text-sm text-gray-600">{item.a}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contact */}
        {context.contact && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-violet-600" />
              <span className="text-violet-700">Contact:</span>
              <a href={`mailto:${context.contact}`} className="text-violet-900 hover:underline">
                {context.contact}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
