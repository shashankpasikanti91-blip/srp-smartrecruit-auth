'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import {
  Menu, X, Zap, ChevronDown,
  Search, Users, BarChart3, FileText, Star,
  Bot, Layers, TrendingUp, MessageSquare,
  Building2, Info, Briefcase, Globe, ShieldCheck,
  BookOpen, Video, Newspaper, GraduationCap, HelpCircle, Mail,
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'

// ── Mega-menu data ─────────────────────────────────────────────────────────

const platformItems = [
  { icon: <Search className="w-4 h-4" />, label: 'All Features', desc: 'Bulk screening, matching, and shortlists', href: '/features' },
  { icon: <Layers className="w-4 h-4" />, label: 'Platform Overview', desc: 'Command center for agency hiring', href: '/platform' },
  { icon: <Users className="w-4 h-4" />, label: 'Agency Pipeline', desc: 'Kanban board for every hiring stage', href: '/platform#pipeline-board' },
  { icon: <Bot className="w-4 h-4" />, label: 'AI Fit Explanations', desc: 'Structured reasons recruiters can trust', href: '/features#matching' },
  { icon: <FileText className="w-4 h-4" />, label: 'Bulk Upload', desc: 'Process large CV batches per job', href: '/features#bulk-screening' },
  { icon: <BarChart3 className="w-4 h-4" />, label: 'Analytics & Reports', desc: 'Pipeline health and screening activity', href: '/platform#analytics' },
  { icon: <MessageSquare className="w-4 h-4" />, label: 'Client Submission', desc: 'Package shortlists for client review', href: '/features#shortlist' },
  { icon: <ShieldCheck className="w-4 h-4" />, label: 'Security & Trust', desc: 'Access controls and data practices', href: '/legal/security' },
]

const agenticItems = [
  { icon: <Bot className="w-4 h-4" />, label: 'AI Assist Layer', desc: 'Recommend and explain — recruiters decide', href: '/#agentic' },
  { icon: <Layers className="w-4 h-4" />, label: 'Screening Workflows', desc: 'Source through submit with human review', href: '/#workflow' },
  { icon: <TrendingUp className="w-4 h-4" />, label: 'Priority Queues', desc: 'Focus review on high-fit profiles', href: '/features#ranking' },
  { icon: <Star className="w-4 h-4" />, label: 'Workspace Analytics', desc: 'Stage counts and recruiter activity', href: '/platform#analytics' },
]

const companyItems = [
  { icon: <Info className="w-4 h-4" />, label: 'About Us', desc: 'Our mission, vision, and story', href: '/company/about' },
  { icon: <Briefcase className="w-4 h-4" />, label: 'Careers', desc: "Join our team — we're hiring", href: '/company/careers' },
  { icon: <Globe className="w-4 h-4" />, label: 'Partners', desc: 'Integration ecosystem and alliances', href: '/company/partners' },
  { icon: <Newspaper className="w-4 h-4" />, label: 'Newsroom', desc: 'Press releases and media kit', href: '/company/newsroom' },
  { icon: <ShieldCheck className="w-4 h-4" />, label: 'Security & Data Protection', desc: 'Access controls and audit practices', href: '/legal/security' },
]

const resourceItems = [
  { icon: <GraduationCap className="w-4 h-4" />, label: 'Academy', desc: 'Recruiting skills bootcamp', href: '/resources/academy' },
  { icon: <BookOpen className="w-4 h-4" />, label: 'eBooks & Guides', desc: 'In-depth recruiting playbooks', href: '/resources/ebooks' },
  { icon: <Newspaper className="w-4 h-4" />, label: 'Blog', desc: 'Tips, trends, and best practices', href: '/resources/blog' },
  { icon: <Video className="w-4 h-4" />, label: 'Videos', desc: 'Walkthroughs and webinar recordings', href: '/resources/videos' },
  { icon: <Building2 className="w-4 h-4" />, label: 'Customer Stories', desc: 'How agencies use SRP Recruit AI', href: '/resources/customers' },
]

const supportItems = [
  { icon: <HelpCircle className="w-4 h-4" />, label: 'Help Center', desc: 'Documentation and how-to guides', href: '/support/help' },
  { icon: <Mail className="w-4 h-4" />, label: 'Contact Support', desc: 'Reach our team any time', href: '/support/contact' },
  { icon: <ShieldCheck className="w-4 h-4" />, label: 'Accessibility', desc: 'Our commitment to inclusive design', href: '/legal/accessibility' },
]

type DropdownKey = 'platform' | 'agentic' | 'company' | 'resources' | 'support' | null

// ── Dropdown panel ─────────────────────────────────────────────────────────

function MegaMenu({ items }: { items: { icon: React.ReactNode; label: string; desc: string; href: string }[] }) {
  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[520px] bg-[#0f0f1a] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 p-2 z-50 grid grid-cols-2 gap-0.5">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors group"
        >
          <span className="mt-0.5 text-indigo-400 group-hover:text-indigo-300 shrink-0">{item.icon}</span>
          <span>
            <span className="block text-sm font-medium text-gray-200 group-hover:text-white">{item.label}</span>
            <span className="block text-xs text-gray-500 mt-0.5">{item.desc}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}

// ── Narrow dropdown (2 col wide) ───────────────────────────────────────────

function DropMenu({ items }: { items: { icon: React.ReactNode; label: string; desc: string; href: string }[] }) {
  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-[#0f0f1a] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 p-2 z-50">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors group"
        >
          <span className="mt-0.5 text-indigo-400 group-hover:text-indigo-300 shrink-0">{item.icon}</span>
          <span>
            <span className="block text-sm font-medium text-gray-200 group-hover:text-white">{item.label}</span>
            <span className="block text-xs text-gray-500 mt-0.5">{item.desc}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}

// ── NavItem with dropdown ──────────────────────────────────────────────────

function NavItem({
  label, active, onClick, children,
}: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={`flex items-center gap-1 text-sm font-medium transition-colors ${
          active ? 'text-white' : 'text-gray-400 hover:text-white'
        }`}
      >
        {label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${active ? 'rotate-180' : ''}`} />
      </button>
      {active && children}
    </div>
  )
}

// ── Navbar ────────────────────────────────────────────────────────────────

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [dropdown, setDropdown] = useState<DropdownKey>(null)
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null)
  const { data: session } = useSession()
  const navRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggle = (key: DropdownKey) => setDropdown(prev => prev === key ? null : key)

  const mobileGroups = [
    { key: 'platform', label: 'Platform', items: platformItems },
    { key: 'agentic', label: 'Agentic AI', items: agenticItems },
    { key: 'company', label: 'Company', items: companyItems },
    { key: 'resources', label: 'Resources', items: resourceItems },
    { key: 'support', label: 'Support', items: supportItems },
  ]

  return (
    <nav ref={navRef} className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:shadow-indigo-500/40 transition-shadow">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">
              SRP <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Recruit AI</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            <NavItem label="Platform" active={dropdown === 'platform'} onClick={() => toggle('platform')}>
              <MegaMenu items={platformItems} />
            </NavItem>
            <NavItem label="Agentic AI" active={dropdown === 'agentic'} onClick={() => toggle('agentic')}>
              <MegaMenu items={agenticItems} />
            </NavItem>
            <NavItem label="Company" active={dropdown === 'company'} onClick={() => toggle('company')}>
              <DropMenu items={companyItems} />
            </NavItem>
            <NavItem label="Resources" active={dropdown === 'resources'} onClick={() => toggle('resources')}>
              <MegaMenu items={resourceItems} />
            </NavItem>
            <NavItem label="Support" active={dropdown === 'support'} onClick={() => toggle('support')}>
              <DropMenu items={supportItems} />
            </NavItem>
            <Link href="/pricing" className="ml-2 text-sm font-medium text-gray-400 hover:text-white transition-colors px-3 py-2">
              Pricing
            </Link>
          </div>

          {/* CTA */}
          <div className="hidden lg:flex items-center gap-3">
            {session ? (
              <div className="flex items-center gap-3">
                <Link href="/dashboard" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Dashboard
                </Link>
                {session.user?.image && (
                  <Image src={session.user.image} alt={session.user.name ?? 'User'} width={32} height={32}
                    className="rounded-full border border-indigo-500/40" />
                )}
                <button onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-sm text-gray-400 hover:text-red-400 transition-colors">
                  Sign Out
                </button>
              </div>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-300 hover:text-white transition-colors font-medium">
                  Sign In
                </Link>
                <Link href="/login"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg hover:shadow-indigo-500/30">
                  Get Started Free
                </Link>
                <Link href="/support/contact"
                  className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:border-white/30 hover:text-white text-sm font-medium transition-all">
                  Contact Sales
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
            onClick={() => { setOpen(!open); setDropdown(null) }} aria-label="Toggle menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {open && (
        <div className="lg:hidden bg-[#0f0f1a]/98 backdrop-blur-xl border-t border-white/5 max-h-[80vh] overflow-y-auto">
          <div className="px-4 py-3 space-y-1">
            {mobileGroups.map((group) => (
              <div key={group.key}>
                <button
                  onClick={() => setMobileExpanded(mobileExpanded === group.key ? null : group.key)}
                  className="w-full flex items-center justify-between py-3 text-sm font-medium text-gray-300 border-b border-white/5"
                >
                  {group.label}
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileExpanded === group.key ? 'rotate-180' : ''}`} />
                </button>
                {mobileExpanded === group.key && (
                  <div className="pt-1 pb-2 space-y-1">
                    {group.items.map((item) => (
                      <Link key={item.label} href={item.href} onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
                        <span className="text-indigo-400 shrink-0">{item.icon}</span>
                        <span>
                          <span className="block text-sm font-medium text-gray-200">{item.label}</span>
                          <span className="block text-xs text-gray-500">{item.desc}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="pt-4 pb-2 flex flex-col gap-2">
              <Link href="/pricing" onClick={() => setOpen(false)}
                className="py-2.5 text-sm text-gray-300 border-b border-white/5">
                Pricing
              </Link>
              {session ? (
                <>
                  <Link href="/dashboard" onClick={() => setOpen(false)} className="block py-2 text-sm text-indigo-400">Dashboard</Link>
                  <button onClick={() => signOut({ callbackUrl: '/' })} className="text-left text-sm text-gray-400 hover:text-red-400">Sign Out</button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)}
                    className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold text-center">
                    Get Started Free
                  </Link>
                  <Link href="/support/contact" onClick={() => setOpen(false)}
                    className="w-full py-2.5 rounded-lg border border-white/10 text-gray-300 text-sm font-medium text-center">
                    Contact Sales
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
