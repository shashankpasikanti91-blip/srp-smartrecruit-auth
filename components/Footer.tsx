import Link from 'next/link'
import { Zap, Linkedin, Mail } from 'lucide-react'

const footerNav = {
  'Get Started': [
    { label: 'Sign In', href: '/login' },
    { label: 'Create Account', href: '/signup' },
    { label: 'Contact Sales', href: '/support/contact' },
    { label: 'Book a Demo', href: '/support/contact' },
  ],
  Platform: [
    { label: 'AI Resume Screening', href: '/#features' },
    { label: 'Candidate Pipeline', href: '/#features' },
    { label: 'Bulk Upload', href: '/#features' },
    { label: 'Interview Scheduling', href: '/#features' },
    { label: 'Analytics & Reports', href: '/#features' },
    { label: 'Bias Reduction', href: '/#features' },
    { label: 'Agentic AI', href: '/#features' },
    { label: 'Pricing', href: '/#pricing' },
  ],
  Company: [
    { label: 'About Us', href: '/company/about' },
    { label: 'Careers', href: '/company/careers' },
    { label: 'Partners', href: '/company/partners' },
    { label: 'Newsroom', href: '/company/newsroom' },
    { label: 'Security & Compliance', href: '/legal/security' },
  ],
  Resources: [
    { label: 'Academy', href: '/resources/academy' },
    { label: 'eBooks & Guides', href: '/resources/ebooks' },
    { label: 'Blog', href: '/resources/blog' },
    { label: 'Videos', href: '/resources/videos' },
    { label: 'Customer Stories', href: '/resources/customers' },
  ],
  Support: [
    { label: 'Help Center', href: '/support/help' },
    { label: 'Contact Support', href: '/support/contact' },
    { label: 'Accessibility', href: '/legal/accessibility' },
    { label: 'Privacy Policy', href: '/legal/privacy' },
    { label: 'Terms of Use', href: '/legal/terms' },
  ],
}

const socials = [
  { icon: <Linkedin className="w-4 h-4" />, href: 'https://www.linkedin.com/company/srp-ai-labs', label: 'LinkedIn' },
  { icon: <Mail className="w-4 h-4" />, href: 'mailto:support@srpailabs.com', label: 'Email' },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-white/5 bg-[#07070e]">
      {/* CTA band */}
      <div className="border-b border-white/5 bg-gradient-to-r from-indigo-950/40 to-purple-950/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-white font-semibold text-lg">Hire 75% faster with SRP Recruit AI</p>
            <p className="text-gray-400 text-sm mt-1">Recruitment strategy tips, guides, and live Q&amp;As delivered to your inbox.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link href="/signup"
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg hover:shadow-indigo-500/30">
              Get started free
            </Link>
            <Link href="/support/contact"
              className="px-5 py-2.5 rounded-lg border border-white/15 text-gray-300 hover:border-white/30 hover:text-white text-sm font-medium transition-all">
              Contact sales
            </Link>
          </div>
        </div>
      </div>

      {/* Main columns */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 mb-14">
          {/* Brand col */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white text-base tracking-tight">
                SRP <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Recruit AI</span>
              </span>
            </Link>
            <p className="text-gray-500 text-xs leading-relaxed mb-5">
              The AI-powered recruiting platform that helps teams match, engage, and hire talent faster.
            </p>
            <div className="flex gap-2 flex-wrap">
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-500 hover:text-indigo-400 hover:bg-white/10 transition-colors">
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link groups */}
          {Object.entries(footerNav).map(([group, items]) => (
            <div key={group}>
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-[0.12em] mb-4">{group}</h3>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href}
                      className="text-gray-500 hover:text-gray-200 text-sm transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <p>© {year} SRP Recruit AI Labs. All rights reserved.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            {[
              { label: 'Terms of Use', href: '/legal/terms' },
              { label: 'Privacy Policy', href: '/legal/privacy' },
              { label: 'Security', href: '/legal/security' },
              { label: 'Accessibility', href: '/legal/accessibility' },
            ].map((l) => (
              <Link key={l.label} href={l.href} className="hover:text-gray-400 transition-colors">{l.label}</Link>
            ))}
          </div>
          <p className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            All systems operational
          </p>
        </div>
      </div>
    </footer>
  )
}
