'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Search, ChevronDown, BookOpen, Video, MessageSquare, ArrowRight } from 'lucide-react'

const categories = [
  { icon: <BookOpen className="w-5 h-5" />, title: 'Getting Started', count: 12 },
  { icon: <Video className="w-5 h-5" />, title: 'Platform Guide', count: 28 },
  { icon: <MessageSquare className="w-5 h-5" />, title: 'Billing & Plans', count: 9 },
  { icon: <Search className="w-5 h-5" />, title: 'Integrations', count: 15 },
]

const faqs = [
  {
    q: 'How do I create my first job post?',
    a: 'From your dashboard, click "New Job Post" in the top right. Fill in the job title, description, and requirements. The more detail you provide in the requirements section, the more accurate the AI scoring will be. Once published, you\'ll get a unique upload link to share with applicants or import resumes directly.',
  },
  {
    q: 'How does the AI scoring work?',
    a: 'Our AI reads your job description and extracts key requirements (skills, experience, qualifications). It then analyses each resume and produces a match score from 0–100 based on how well the candidate fulfils those requirements. The score considers both hard skills (tools, certifications) and soft skills (leadership, communication), not just keyword presence.',
  },
  {
    q: 'Can I upload multiple resumes at once?',
    a: 'Yes. Use the "Bulk Upload" feature to upload a .zip file containing up to 1,000 PDF or DOCX resumes. The AI processes all of them in parallel. Once complete, you\'ll receive a ranked shortlist and can export results as a CSV with all AI scores and structured candidate data.',
  },
  {
    q: 'How do I change a candidate\'s status?',
    a: 'In the Candidates view, click any candidate card to open their profile. Use the "Status" dropdown to move them between stages: Applied → Screening → Interview → Offer → Hired / Rejected. Stage changes are logged and can trigger automated email notifications if you have them enabled.',
  },
  {
    q: 'What file formats does SRP accept?',
    a: 'We accept PDF, DOCX, and DOC formats for individual resume uploads. For bulk uploads, pack files into a .zip archive. Maximum individual file size is 10MB. Maximum bulk zip size is 500MB.',
  },
  {
    q: 'How do I connect my Google account for sign-in?',
    a: 'On the login page, click "Continue with Google". You\'ll be redirected to Google\'s auth screen. After granting permission, you\'ll be returned to your SRP dashboard. If you already have an account with the same email, your accounts will be linked automatically.',
  },
  {
    q: 'Can I invite team members to my account?',
    a: 'Yes. Go to Settings → Team and click "Invite member". Enter their email address and assign a role (Admin, Recruiter, or Viewer). They\'ll receive an invite email with a link to set up their account. Team collaboration requires a Team or Enterprise plan.',
  },
  {
    q: 'How do I export candidate data?',
    a: 'From the Candidates view, select the candidates you want to export using the checkboxes, then click the "Export" button. You can export as CSV (recommended for spreadsheets) or JSON (for integrations). The export includes AI scores, parsed data, and status history.',
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'Go to Settings → Billing → Cancel Subscription. Your access will continue until the end of your current billing period. Annual plan refund requests within 14 days of purchase can be made by emailing billing@srpailabs.com.',
  },
  {
    q: 'What is the Agentic AI feature?',
    a: 'Agentic AI is our autonomous sourcing and screening engine. When enabled for a job, the AI agent continuously searches for matching candidates, ranks them, and adds them to your pipeline — without you having to trigger anything manually. You set the criteria once and the agent works in the background.',
  },
]

export default function HelpPage() {
  const [open, setOpen] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const filtered = faqs.filter(f =>
    f.q.toLowerCase().includes(search.toLowerCase()) ||
    f.a.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#07070e] pt-16">

        {/* Hero with search */}
        <section className="relative py-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 mb-5">
              Help Center
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">How can we help?</h1>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search articles, FAQs..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-all"
              />
            </div>
          </div>
        </section>

        {/* Category cards */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categories.map((c) => (
            <div key={c.title} className="bg-white/3 border border-white/8 rounded-xl p-4 text-center hover:border-indigo-500/30 hover:bg-white/5 transition-all cursor-pointer">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mx-auto mb-2">
                {c.icon}
              </div>
              <p className="text-white text-sm font-medium">{c.title}</p>
              <p className="text-gray-600 text-xs mt-0.5">{c.count} articles</p>
            </div>
          ))}
        </section>

        {/* FAQ Accordion */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <h2 className="text-xl font-bold text-white mb-6">
            {search ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${search}"` : 'Frequently asked questions'}
          </h2>
          <div className="space-y-2">
            {filtered.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">No results found. Try different keywords or <Link href="/support/contact" className="text-indigo-400 hover:text-indigo-300">contact support</Link>.</p>
            )}
            {filtered.map((f, i) => (
              <div key={f.q} className="bg-white/3 border border-white/8 rounded-xl overflow-hidden hover:border-white/12 transition-colors">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
                >
                  <span className="text-white text-sm font-medium">{f.q}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
                </button>
                {open === i && (
                  <div className="px-5 pb-5 border-t border-white/5">
                    <p className="text-gray-400 text-sm leading-relaxed mt-3">{f.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Contact CTA */}
        <section className="border-t border-white/5 bg-white/2 py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-xl font-bold text-white mb-3">Still need help?</h2>
            <p className="text-gray-400 text-sm mb-6">Our support team responds within 1 business day. For urgent issues, enterprise customers have a dedicated Slack channel.</p>
            <Link href="/support/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg hover:shadow-indigo-500/30">
              Contact support <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
