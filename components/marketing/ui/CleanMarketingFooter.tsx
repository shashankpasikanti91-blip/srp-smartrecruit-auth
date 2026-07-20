import Link from 'next/link'
import { Zap, Linkedin, Mail } from 'lucide-react'
import { FOOTER_COMPANY, FOOTER_LEGAL, FOOTER_PRODUCT, MARKETING_ROUTES } from '@/content/marketing/navigation'

const FOOTER_COLUMNS = [
  { title: 'Product', links: FOOTER_PRODUCT },
  { title: 'Company', links: FOOTER_COMPANY },
  { title: 'Legal', links: FOOTER_LEGAL },
] as const

export default function CleanMarketingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="marketing-footer">
      <div className="marketing-footer-inner">
        <div className="marketing-footer-top">
          <div className="marketing-footer-brand">
            <Link href={MARKETING_ROUTES.home} className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" aria-hidden />
              </div>
              <span className="font-bold text-white">SRP Recruit AI</span>
            </Link>
            <p className="text-slate-500 text-sm leading-relaxed">
              AI-assisted recruitment intelligence for agencies — screen, rank, explain, and prepare client-ready shortlists with recruiter oversight.
            </p>
            <div className="flex gap-2 mt-4">
              <a
                href="https://www.linkedin.com/company/srp-ai-labs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-cyan-400 transition-colors"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href="mailto:support@srpailabs.com"
                aria-label="Email"
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-cyan-400 transition-colors"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          <nav className="marketing-footer-nav" aria-label="Footer">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title} className="marketing-footer-col">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-3">{col.title}</h3>
                <ul className="space-y-2">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-sm text-slate-500 hover:text-slate-200 transition-colors">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="marketing-footer-bottom">
          <p>© {year} SRP AI Labs. All rights reserved.</p>
          <Link href={MARKETING_ROUTES.contact} className="hover:text-slate-400 transition-colors">
            Book a demo →
          </Link>
        </div>
      </div>
    </footer>
  )
}
