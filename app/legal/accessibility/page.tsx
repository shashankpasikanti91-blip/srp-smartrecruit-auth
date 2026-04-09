import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { CheckCircle, Mail } from 'lucide-react'

const features = [
  { title: 'Keyboard navigation', desc: 'All interactive elements are fully operable via keyboard. Tab order follows a logical and intuitive sequence.' },
  { title: 'Screen reader support', desc: 'All images have descriptive alt text. Form inputs have associated labels. ARIA roles and landmarks are used throughout.' },
  { title: 'Sufficient colour contrast', desc: 'Text meets WCAG 2.1 AA contrast ratio requirements (4.5:1 for normal text, 3:1 for large text).' },
  { title: 'Resizable text', desc: 'All text can be resized up to 200% without loss of content or functionality.' },
  { title: 'No seizure-inducing content', desc: 'Our platform does not contain content that flashes more than 3 times per second.' },
  { title: 'Focus indicators', desc: 'Visible focus indicators are present on all interactive elements for keyboard users.' },
  { title: 'Error identification', desc: 'Form errors are clearly identified and described in text, not colour alone.' },
  { title: 'Consistent navigation', desc: 'Navigation is presented in a consistent order across all pages.' },
]

const known = [
  'Some older PDF exports may not be fully screen-reader-accessible. We are working on a remediation.',
  'Certain data visualisation charts may not fully meet WCAG 2.1 AA for non-text contrast. Alternative table views are available.',
]

export default function AccessibilityPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#07070e] pt-16">

        {/* Header */}
        <section className="border-b border-white/5 py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 mb-4">Legal</span>
            <h1 className="text-4xl font-bold text-white mb-3">Accessibility Statement</h1>
            <p className="text-gray-500 text-sm">Last reviewed: June 15, 2025</p>
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">

          {/* Commitment */}
          <div>
            <h2 className="text-white font-semibold text-xl mb-3">Our commitment</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              SRP Recruit AI Labs is committed to ensuring that our platform is accessible to all users,
              regardless of ability or assistive technology. We strive to conform to the{' '}
              <strong className="text-gray-300">Web Content Accessibility Guidelines (WCAG) 2.1 Level AA</strong>.
            </p>
          </div>

          {/* Standards */}
          <div>
            <h2 className="text-white font-semibold text-xl mb-4">Accessibility features</h2>
            <div className="space-y-3">
              {features.map((f) => (
                <div key={f.title} className="flex items-start gap-3 bg-white/2 border border-white/6 rounded-lg px-4 py-3">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white text-sm font-medium">{f.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conformance status */}
          <div>
            <h2 className="text-white font-semibold text-xl mb-3">Conformance status</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              We believe our platform is <strong className="text-white">partially conformant</strong> with WCAG 2.1 Level AA.
              Partially conformant means that some parts of the content do not fully conform to the accessibility standard.
            </p>
          </div>

          {/* Known issues */}
          <div>
            <h2 className="text-white font-semibold text-xl mb-3">Known limitations</h2>
            <ul className="space-y-2">
              {known.map((k) => (
                <li key={k} className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="text-yellow-500 shrink-0">•</span>{k}
                </li>
              ))}
            </ul>
          </div>

          {/* Feedback */}
          <div className="bg-white/3 border border-white/8 rounded-xl p-6">
            <h2 className="text-white font-semibold text-lg mb-2">Feedback & contact</h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              If you experience any accessibility barriers on our platform, or if you need information in an
              alternative format, please contact us. We aim to respond to accessibility queries within 2 business days.
            </p>
            <a href="mailto:accessibility@srpailabs.com"
              className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">
              <Mail className="w-4 h-4" /> accessibility@srpailabs.com
            </a>
          </div>

          {/* Legal */}
          <div>
            <h2 className="text-white font-semibold text-xl mb-3">Formal complaints</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              If you are not satisfied with our response, you have the right to complain to the relevant
              enforcement authority in your country. In the EU, this would be your local Data Protection Authority.
              In India, concerns may be raised with the Ministry of Electronics and Information Technology.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
