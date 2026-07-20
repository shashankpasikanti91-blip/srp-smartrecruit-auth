import type { Metadata } from 'next'
import { CheckCircle, Mail } from 'lucide-react'
import MarketingLayout from '@/components/marketing/MarketingLayout'
import LegalPageShell from '@/components/marketing/ui/LegalPageShell'
import { SUBPAGES } from '@/content/marketing/subpages'

const features = [
  { title: 'Keyboard navigation', desc: 'Interactive elements are operable via keyboard with logical tab order.' },
  { title: 'Screen reader support', desc: 'Labels, landmarks, and alt text are used across marketing and product surfaces.' },
  { title: 'Colour contrast', desc: 'We aim for readable contrast on text and interactive controls.' },
  { title: 'Resizable text', desc: 'Layouts are designed to support browser text scaling.' },
  { title: 'Focus indicators', desc: 'Visible focus states on interactive elements.' },
  { title: 'Reduced motion', desc: 'Marketing animations respect prefers-reduced-motion settings.' },
]

export const metadata: Metadata = {
  title: 'Accessibility | SRP Recruit AI',
  description: SUBPAGES.accessibility.subtitle,
}

export default function AccessibilityPage() {
  return (
    <MarketingLayout>
      <LegalPageShell
        eyebrow={SUBPAGES.accessibility.eyebrow}
        title={SUBPAGES.accessibility.title}
        subtitle="Last reviewed: June 15, 2025"
      >
        <p className="text-slate-400 text-sm leading-relaxed mb-8 not-prose">
          SRP Recruit AI Labs is committed to improving accessibility across our marketing site and product.
          We work toward WCAG 2.1 Level AA where practical and welcome feedback on barriers you encounter.
        </p>

        <h2 className="text-white font-semibold text-lg mb-4 not-prose">Accessibility features</h2>
        <div className="space-y-3 mb-10 not-prose">
          {features.map((f) => (
            <div key={f.title} className="flex items-start gap-3 marketing-glass rounded-lg px-4 py-3 border border-white/8">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-white text-sm font-medium">{f.title}</p>
                <p className="text-slate-500 text-xs mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="marketing-glass rounded-xl p-6 border border-white/10 not-prose">
          <h2 className="text-white font-semibold text-lg mb-2">Feedback</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            Report accessibility barriers or request alternative formats. We aim to respond within two business days.
          </p>
          <a href="mailto:accessibility@srpailabs.com" className="inline-flex items-center gap-2 text-cyan-400 text-sm font-medium">
            <Mail className="w-4 h-4" aria-hidden /> accessibility@srpailabs.com
          </a>
        </div>
      </LegalPageShell>
    </MarketingLayout>
  )
}
