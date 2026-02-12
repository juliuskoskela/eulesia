import { ArrowLeft, Globe, Code, Users, Building2, Shield, Sparkles, BookOpen, Scale, Landmark, FlaskConical, ArrowRight, MapPin, Mail, CircleDot, GraduationCap, UserCheck, Coins } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Layout } from '../components/layout'
import { useAuth } from '../hooks/useAuth'

function PublicHeader() {
  const { t } = useTranslation('about')
  return (
    <header className="bg-blue-900 px-4 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
          <span className="text-blue-800 font-bold text-xl">E</span>
        </div>
        <span className="text-white font-semibold text-xl">Eulesia</span>
      </div>
      <Link
        to="/"
        className="text-blue-200 hover:text-white text-sm transition-colors"
      >
        {t('signIn')}
      </Link>
    </header>
  )
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          {icon}
          {title}
        </h2>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}

function AboutContent() {
  const { t } = useTranslation('about')
  const { isAuthenticated } = useAuth()

  return (
    <>
      {/* Back navigation (only for authenticated users) */}
      {isAuthenticated && (
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('back')}
          </Link>
        </div>
      )}

      {/* Hero */}
      <div className="bg-blue-900 px-4 py-8 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
            <span className="text-blue-900 font-bold text-xl">E</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Eulesia</h1>
            <p className="text-blue-200 text-sm">{t('heroSubtitle')}</p>
          </div>
        </div>
        <p className="text-blue-100 leading-relaxed text-lg">
          {t('heroDescription')}
        </p>
        <div className="mt-4 inline-flex items-center gap-2 bg-blue-800/60 text-blue-200 text-xs px-3 py-1.5 rounded-full">
          <Sparkles className="w-3 h-3" />
          {t('earlyStage')}
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">

        {/* Introduction — 3 paragraphs, no card wrapper */}
        <div className="space-y-4 py-2">
          <p className="text-gray-800 leading-relaxed">
            {t('intro.p1')}
          </p>
          <p className="text-gray-800 leading-relaxed">
            {t('intro.p2')}
          </p>
          <p className="text-gray-800 leading-relaxed">
            {t('intro.p3')}
          </p>
        </div>

        {/* Why is this needed? */}
        <SectionCard
          icon={<BookOpen className="w-4 h-4 text-blue-600" />}
          title={t('problem.title')}
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-700 leading-relaxed">
              {t('problem.p1')}
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              {t('problem.p2')}
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              {t('problem.p3')}
            </p>
          </div>
        </SectionCard>

        {/* How Eulesia differs — comparison matrix */}
        <SectionCard
          icon={<Scale className="w-4 h-4 text-blue-600" />}
          title={t('comparison.title')}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700 leading-relaxed">
              {t('comparison.description')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="font-medium text-gray-900 text-sm">{t('comparison.quadrant1Title')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('comparison.quadrant1Platforms')}</p>
                <p className="text-xs text-gray-600 mt-1.5">{t('comparison.quadrant1Desc')}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="font-medium text-gray-900 text-sm">{t('comparison.quadrant2Title')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('comparison.quadrant2Platforms')}</p>
                <p className="text-xs text-gray-600 mt-1.5">{t('comparison.quadrant2Desc')}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="font-medium text-gray-900 text-sm">{t('comparison.quadrant3Title')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('comparison.quadrant3Platforms')}</p>
                <p className="text-xs text-gray-600 mt-1.5">{t('comparison.quadrant3Desc')}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <p className="font-medium text-blue-900 text-sm">{t('comparison.quadrant4Title')}</p>
                <p className="text-xs text-blue-700 mt-1.5">{t('comparison.quadrant4Desc')}</p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Four spaces */}
        <SectionCard
          icon={<Globe className="w-4 h-4 text-blue-600" />}
          title={t('fourSpaces.title')}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700 leading-relaxed mb-2">
              {t('fourSpaces.description')}
            </p>

            <div className="flex gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Landmark className="w-4 h-4 text-blue-700" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{t('fourSpaces.agora')}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {t('fourSpaces.agoraDesc')}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-violet-700" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{t('fourSpaces.clubs')}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {t('fourSpaces.clubsDesc')}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-teal-700" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{t('fourSpaces.home')}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {t('fourSpaces.homeDesc')}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{t('fourSpaces.services')}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {t('fourSpaces.servicesDesc')}
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Design principles */}
        <SectionCard
          icon={<CircleDot className="w-4 h-4 text-blue-600" />}
          title={t('principles.title')}
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-700 leading-relaxed mb-2">
              {t('principles.description')}
            </p>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-900 text-sm">{t('principles.identity')}</p>
              <p className="text-xs text-gray-600 mt-1">{t('principles.identityDesc')}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-900 text-sm">{t('principles.institutional')}</p>
              <p className="text-xs text-gray-600 mt-1">{t('principles.institutionalDesc')}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-900 text-sm">{t('principles.socialAgency')}</p>
              <p className="text-xs text-gray-600 mt-1">{t('principles.socialAgencyDesc')}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-900 text-sm">{t('principles.noAttention')}</p>
              <p className="text-xs text-gray-600 mt-1">{t('principles.noAttentionDesc')}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-900 text-sm">{t('principles.publicGovernance')}</p>
              <p className="text-xs text-gray-600 mt-1">{t('principles.publicGovernanceDesc')}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-900 text-sm">{t('principles.privacy')}</p>
              <p className="text-xs text-gray-600 mt-1">{t('principles.privacyDesc')}</p>
            </div>
          </div>
        </SectionCard>

        {/* Automated content */}
        <SectionCard
          icon={<Sparkles className="w-4 h-4 text-blue-600" />}
          title={t('automated.title')}
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-700 leading-relaxed">
              {t('automated.p1')}
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              {t('automated.p2')}
            </p>
          </div>
        </SectionCard>

        {/* Who is Eulesia for? */}
        <SectionCard
          icon={<UserCheck className="w-4 h-4 text-blue-600" />}
          title={t('forWhom.title')}
        >
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-blue-700" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{t('forWhom.citizens')}</h3>
                <p className="text-sm text-gray-600 mt-1">{t('forWhom.citizensDesc')}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-violet-700" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{t('forWhom.municipalities')}</h3>
                <p className="text-sm text-gray-600 mt-1">{t('forWhom.municipalitiesDesc')}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-4 h-4 text-teal-700" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{t('forWhom.researchers')}</h3>
                <p className="text-sm text-gray-600 mt-1">{t('forWhom.researchersDesc')}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Code className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{t('forWhom.developers')}</h3>
                <p className="text-sm text-gray-600 mt-1">{t('forWhom.developersDesc')}</p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Research foundation */}
        <SectionCard
          icon={<FlaskConical className="w-4 h-4 text-blue-600" />}
          title={t('research.title')}
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-700 leading-relaxed">
              {t('research.p1')}
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              {t('research.p2')}
            </p>
            <p className="text-xs text-gray-500 italic mt-2 border-t border-gray-100 pt-3">
              {t('research.paper')}
            </p>
          </div>
        </SectionCard>

        {/* Open source */}
        <SectionCard
          icon={<Code className="w-4 h-4 text-blue-600" />}
          title={t('openSource.title')}
        >
          <p className="text-sm text-gray-700 mb-3">
            {t('openSource.description')}
          </p>
          <a
            href="https://github.com/markussjoberg/eulesia"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            {t('openSource.viewOnGithub')}
          </a>
        </SectionCard>

        {/* EU alignment */}
        <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3">
          <span className="text-3xl">🇪🇺</span>
          <div>
            <p className="font-medium text-blue-900">{t('euAlignment.title')}</p>
            <p className="text-sm text-blue-700 mt-1">
              {t('euAlignment.description')}
            </p>
          </div>
        </div>

        {/* Roadmap */}
        <SectionCard
          icon={<MapPin className="w-4 h-4 text-blue-600" />}
          title={t('roadmap.title')}
        >
          <div className="space-y-4">
            {/* Now */}
            <div className="relative pl-6 border-l-2 border-blue-500">
              <div className="absolute -left-[7px] top-0.5 w-3 h-3 bg-blue-500 rounded-full" />
              <h3 className="font-medium text-blue-900 text-sm">{t('roadmap.now')}</h3>
              <ul className="mt-1.5 space-y-1">
                {(t('roadmap.nowItems', { returnObjects: true }) as string[]).map((item, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-blue-400 mt-1 flex-shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Q2-Q3 2026 */}
            <div className="relative pl-6 border-l-2 border-gray-200">
              <div className="absolute -left-[7px] top-0.5 w-3 h-3 bg-gray-300 rounded-full" />
              <h3 className="font-medium text-gray-700 text-sm">{t('roadmap.q2q3')}</h3>
              <ul className="mt-1.5 space-y-1">
                {(t('roadmap.q2q3Items', { returnObjects: true }) as string[]).map((item, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-gray-400 mt-1 flex-shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Late 2026 */}
            <div className="relative pl-6 border-l-2 border-gray-200">
              <div className="absolute -left-[7px] top-0.5 w-3 h-3 bg-gray-300 rounded-full" />
              <h3 className="font-medium text-gray-700 text-sm">{t('roadmap.late2026')}</h3>
              <ul className="mt-1.5 space-y-1">
                {(t('roadmap.late2026Items', { returnObjects: true }) as string[]).map((item, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-gray-400 mt-1 flex-shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>

        {/* Organization & Team */}
        <SectionCard
          icon={<Users className="w-4 h-4 text-blue-600" />}
          title={t('organization.title')}
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-700 leading-relaxed">
              {t('organization.p1')}
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              {t('organization.p2')}
            </p>
            <a
              href={`mailto:${t('organization.contact')}`}
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
            >
              <Mail className="w-4 h-4" />
              {t('organization.contact')}
            </a>
          </div>
        </SectionCard>

        {/* Funding */}
        <SectionCard
          icon={<Coins className="w-4 h-4 text-blue-600" />}
          title={t('funding.title')}
        >
          <p className="text-sm text-gray-700 mb-2">{t('funding.description')}</p>
          <ul className="space-y-1">
            {(t('funding.items', { returnObjects: true }) as string[]).map((item, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-blue-400 mt-1 flex-shrink-0">•</span>
                {item}
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* CTA for non-authenticated */}
        {!isAuthenticated && (
          <div className="bg-blue-900 rounded-xl p-5 text-center">
            <h3 className="text-white font-semibold mb-2">{t('cta.title')}</h3>
            <p className="text-blue-200 text-sm mb-4">
              {t('cta.description')}
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-white text-blue-900 px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-blue-50 transition-colors"
            >
              {t('cta.button')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </>
  )
}

export function AboutPage() {
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) {
    return (
      <Layout>
        <AboutContent />
      </Layout>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <div className="max-w-4xl mx-auto">
        <AboutContent />
      </div>
    </div>
  )
}
