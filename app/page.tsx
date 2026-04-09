import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import {
  Brain,
  Users,
  Zap,
  Shield,
  BarChart3,
  Clock,
  CheckCircle2,
  ArrowRight,
  Star,
  Rocket,
  Search,
  FileText,
  Target,
} from 'lucide-react'

// ── Data ──────────────────────────────────────────────────────────────────────

const stats = [
  { value: '500+', label: 'Companies Using SRP' },
  { value: '50K+', label: 'Candidates Processed' },
  { value: '95%', label: 'Screening Accuracy' },
  { value: '3×', label: 'Faster Hiring' },
]

const features = [
  {
    icon: <Brain className="w-6 h-6" />,
    title: 'AI-Powered Screening',
    description:
      'Our LLM engine reads every resume, extracts skills, and ranks candidates against your job requirements automatically.',
    color: 'from-indigo-500 to-purple-600',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Bulk Resume Processing',
    description:
      'Upload hundreds of resumes at once. Get a ranked shortlist in minutes, not days.',
    color: 'from-amber-500 to-orange-600',
  },
  {
    icon: <Target className="w-6 h-6" />,
    title: 'Smart Job Matching',
    description:
      'Semantic matching goes beyond keywords — it understands context, experience levels, and transferable skills.',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: 'Analytics & Insights',
    description:
      'Real-time dashboards show pipeline health, time-to-hire, and diversity metrics at a glance.',
    color: 'from-sky-500 to-blue-600',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Bias Reduction',
    description:
      'Built-in fairness filters anonymize names, photos, and age signals before the AI evaluates candidates.',
    color: 'from-pink-500 to-rose-600',
  },
  {
    icon: <Clock className="w-6 h-6" />,
    title: 'Automated Workflows',
    description:
      'Trigger emails, schedule interviews, and update your ATS automatically when candidates move through stages.',
    color: 'from-violet-500 to-purple-700',
  },
]

const steps = [
  {
    number: '01',
    icon: <FileText className="w-6 h-6 text-indigo-400" />,
    title: 'Post Your Job',
    description:
      'Create a job post in seconds using our AI-assisted editor. Describe the role and let our engine generate the perfect requirements.',
  },
  {
    number: '02',
    icon: <Search className="w-6 h-6 text-purple-400" />,
    title: 'AI Screens Candidates',
    description:
      'Upload resumes or sync with job boards. Our AI reads, scores, and ranks every applicant in real time.',
  },
  {
    number: '03',
    icon: <Users className="w-6 h-6 text-pink-400" />,
    title: 'Review & Hire',
    description:
      'Get a clean shortlist with AI explanations for each candidate. One click to schedule, reject, or advance.',
  },
]

const testimonials = [
  {
    quote:
      '"SRP cut our time-to-screen from 5 days to 20 minutes. The AI recommendations are frighteningly accurate."',
    name: 'Sarah Chen',
    role: 'Head of Talent, TechCorp',
    rating: 5,
  },
  {
    quote:
      '"We process 2,000+ applications a month. Without SRP it would be impossible. Best tool in our stack."',
    name: 'James Wright',
    role: 'Recruiting Lead, ScaleUp',
    rating: 5,
  },
  {
    quote:
      '"The bias-reduction features helped us increase diversity hires by 40%. It is a game-changer."',
    name: 'Priya Nair',
    role: 'VP People, Finova',
    rating: 5,
  },
]

const pricing = [
  {
    name: 'Starter',
    price: '$0',
    period: 'forever',
    description: 'Perfect for small teams getting started.',
    features: ['5 active jobs', '100 candidates/mo', 'AI screening', 'Email support'],
    cta: 'Start free',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '$49',
    period: 'per seat / month',
    description: 'For growing teams that need more power.',
    features: ['Unlimited jobs', '2,000 candidates/mo', 'Bulk upload', 'Analytics', 'Priority support'],
    cta: 'Start 14-day trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact us',
    description: 'For large orgs with bespoke requirements.',
    features: ['Unlimited everything', 'SSO / SAML', 'Dedicated CSM', 'SLA guarantee', 'API access'],
    cta: 'Talk to sales',
    highlighted: false,
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <main className="overflow-x-hidden">
      <Navbar transparent />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 overflow-hidden bg-[#0a0a0f]">
        {/* Background orbs */}
        <div className="orb w-96 h-96 bg-indigo-600 top-10 -left-20" />
        <div className="orb w-80 h-80 bg-purple-700 bottom-20 -right-10" style={{ animationDelay: '-4s' }} />
        <div className="orb w-64 h-64 bg-pink-600 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ animationDelay: '-2s' }} />

        {/* Badge */}
        <div className="relative z-10 mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-xs font-medium text-indigo-300">
          <Rocket className="w-3.5 h-3.5" />
          Powered by GPT-4 · Now with Bulk Screening
        </div>

        {/* Headline */}
        <h1 className="relative z-10 text-5xl sm:text-6xl md:text-7xl font-extrabold text-white leading-tight tracking-tight max-w-5xl animate-fade-in-up">
          Hire Smarter with{' '}
          <span className="gradient-text">Artificial Intelligence</span>
        </h1>

        <p className="relative z-10 mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          SRP AI Labs automates candidate screening, ranks applicants by fit, and moves the best talent
          through your pipeline — all in minutes.
        </p>

        {/* CTAs */}
        <div className="relative z-10 mt-10 flex flex-col sm:flex-row items-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <Link
            href="/login"
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-base transition-all btn-glow flex items-center gap-2 shadow-lg"
          >
            Get Started Free <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="https://recruit.srpailabs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 rounded-xl glass-card text-white font-semibold text-base hover:bg-white/10 transition-colors"
          >
            Open Recruit →
          </a>
        </div>

        {/* Stats */}
        <div className="relative z-10 mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl w-full animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          {stats.map((stat) => (
            <div key={stat.label} className="glass-card rounded-2xl p-5 text-center">
              <div className="text-3xl font-extrabold gradient-text">{stat.value}</div>
              <div className="mt-1 text-xs text-gray-500 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <div className="w-px h-10 bg-gradient-to-b from-indigo-400 to-transparent animate-pulse" />
          <span className="text-xs text-gray-500">Scroll to explore</span>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section id="features" className="py-28 px-4 bg-[#0d0d1a]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-indigo-400 text-sm font-semibold uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white">
              Everything you need to hire at scale
            </h2>
            <p className="mt-4 text-gray-400 text-lg max-w-2xl mx-auto">
              From first application to signed offer — SRP AI Labs handles every step with intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="glass-card rounded-2xl p-7 group hover:border-white/15 transition-all hover:-translate-y-1"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-5 shadow-lg`}>
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-28 px-4 bg-[#0a0a0f]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-purple-400 text-sm font-semibold uppercase tracking-widest mb-3">Process</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white">
              Hire in three simple steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line — desktop only */}
            <div className="hidden md:block absolute top-14 left-[calc(16.66%+2rem)] right-[calc(16.66%+2rem)] h-px bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-pink-500/30" />

            {steps.map((step, i) => (
              <div key={step.number} className="relative flex flex-col items-center text-center" style={{ animationDelay: `${i * 0.15}s` }}>
                <div className="w-20 h-20 rounded-2xl glass-card flex flex-col items-center justify-center mb-6 relative z-10 border border-white/10">
                  {step.icon}
                  <span className="text-[10px] font-bold text-gray-600 mt-1">{step.number}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────────────── */}
      <section className="py-28 px-4 bg-[#0d0d1a]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-3">Testimonials</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white">
              Teams that trust SRP
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="glass-card rounded-2xl p-7 flex flex-col">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed flex-1 italic">{t.quote}</p>
                <div className="mt-6 pt-4 border-t border-white/5">
                  <p className="text-white font-semibold text-sm">{t.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-28 px-4 bg-[#0a0a0f]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-gray-400 text-lg">Start free — no credit card required.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 flex flex-col ${
                  plan.highlighted
                    ? 'bg-gradient-to-b from-indigo-600/20 to-purple-600/10 border border-indigo-500/40 shadow-xl shadow-indigo-500/10'
                    : 'glass-card'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold">
                      Most Popular
                    </span>
                  </div>
                )}
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                  <span className="text-gray-500 text-sm mb-1">/ {plan.period}</span>
                </div>
                <p className="mt-2 text-gray-500 text-sm">{plan.description}</p>
                <ul className="mt-6 space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`mt-8 w-full py-3 rounded-xl text-center font-semibold text-sm transition-all ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white btn-glow'
                      : 'glass-card text-white hover:bg-white/10'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────────────── */}
      <section className="py-28 px-4 bg-[#0d0d1a]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative rounded-3xl overflow-hidden p-12 bg-gradient-to-br from-indigo-900/60 via-purple-900/50 to-pink-900/40 border border-indigo-500/20 shadow-2xl shadow-indigo-500/10">
            {/* Background orbs */}
            <div className="orb w-64 h-64 bg-indigo-600 -top-10 -left-10 opacity-20" />
            <div className="orb w-48 h-48 bg-purple-600 -bottom-10 -right-10 opacity-20" />

            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
                Ready to transform your hiring?
              </h2>
              <p className="text-gray-300 text-lg mb-10 max-w-xl mx-auto">
                Join 500+ companies already using SRP AI Labs to hire faster, smarter, and at scale.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-white text-indigo-700 font-extrabold text-base hover:bg-indigo-50 transition-colors shadow-lg"
              >
                Start for free <ArrowRight className="w-5 h-5" />
              </Link>
              <p className="mt-4 text-gray-500 text-xs">No credit card · 14-day trial on Pro</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
