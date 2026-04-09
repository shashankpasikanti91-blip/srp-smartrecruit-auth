import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Shield, Lock, Server, Eye, CheckCircle } from 'lucide-react'

const pillars = [
  {
    icon: <Lock className="w-6 h-6" />,
    title: 'Encryption everywhere',
    items: [
      'AES-256 encryption for all data at rest',
      'TLS 1.3 for all data in transit',
      'Database fields encrypted at the column level',
      'Encryption keys managed via hardware security modules (HSM)',
    ],
  },
  {
    icon: <Server className="w-6 h-6" />,
    title: 'Infrastructure security',
    items: [
      'Hosted on ISO 27001-certified infrastructure',
      'Network-level firewall rules — minimal ingress by default',
      'Container image scanning on every build',
      'Automated vulnerability patching cycle (<48h for critical)',
    ],
  },
  {
    icon: <Eye className="w-6 h-6" />,
    title: 'Access controls',
    items: [
      'Role-based access control (RBAC) at every layer',
      'Multi-factor authentication enforced for admin accounts',
      'Principle of least privilege for all internal systems',
      'All admin actions logged and auditable',
    ],
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Compliance & auditing',
    items: [
      'GDPR compliant — DPA available on request',
      'Annual third-party penetration testing',
      'SOC 2 Type II audit in progress',
      'Dedicated Data Protection Officer (DPO)',
    ],
  },
]

const faqs = [
  {
    q: 'Where is my data stored?',
    a: 'All customer data is stored on servers located in the EU (Germany) or Asia-Pacific (Singapore) depending on your account region selection at signup. We do not transfer data outside your selected region without explicit consent.',
  },
  {
    q: 'Can your staff read my candidate data?',
    a: 'No SRP employee can access your candidate data without your explicit consent for a support request. All access requests are gated behind a formal approval process and are logged.',
  },
  {
    q: 'What happens if there\'s a security incident?',
    a: 'In the event of a confirmed data breach, we will notify affected customers within 72 hours as required by GDPR. We will provide a full post-mortem report and steps taken to remediate.',
  },
  {
    q: 'Is SRP AI compliant in the EU?',
    a: 'Yes. Our AI systems operate under human oversight — all candidate scores are recommendations, and hiring decisions remain with humans. We monitor our models for bias and produce AI transparency documentation available on request.',
  },
]

export default function SecurityPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#07070e] pt-16">

        {/* Hero */}
        <section className="relative py-20 border-b border-white/5 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-green-950/15 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-green-400 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20 mb-5">
              Security
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Security is not a feature. It's a foundation.
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Your candidate data is sensitive. We treat it that way. Here's exactly how we keep it safe.
            </p>
          </div>
        </section>

        {/* Pillars */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {pillars.map((p) => (
            <div key={p.title} className="bg-white/3 border border-white/8 rounded-xl p-6 hover:border-green-500/20 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                  {p.icon}
                </div>
                <h2 className="text-white font-semibold">{p.title}</h2>
              </div>
              <ul className="space-y-2">
                {p.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-400">
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* FAQ */}
        <section className="border-t border-white/5 bg-white/2 py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-white mb-8 text-center">Common security questions</h2>
            <div className="space-y-5">
              {faqs.map((f) => (
                <div key={f.q} className="bg-white/3 border border-white/8 rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-2">{f.q}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-xl font-bold text-white mb-3">Found a vulnerability?</h2>
          <p className="text-gray-400 text-sm mb-4">
            We have a responsible disclosure programme. Report security findings to:
          </p>
          <a href="mailto:security@srpailabs.com"
            className="text-green-400 hover:text-green-300 font-semibold transition-colors">
            security@srpailabs.com
          </a>
          <p className="text-gray-600 text-xs mt-2">We acknowledge reports within 24 hours and aim to resolve critical issues within 72 hours.</p>
        </section>
      </main>
      <Footer />
    </>
  )
}
