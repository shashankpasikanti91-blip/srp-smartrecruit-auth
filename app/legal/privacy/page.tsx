import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const sections = [
  {
    title: '1. Information we collect',
    content: `We collect information you provide directly to us, such as when you create an account, use our services, or contact us for support. This includes:

• Account information (name, email address, password)
• Profile information you choose to provide
• Candidates' resume data you upload for processing
• Usage information about how you interact with our services
• Communications you send us

We also collect information automatically when you use our services, including log data, device information, and cookies.`,
  },
  {
    title: '2. How we use your information',
    content: `We use the information we collect to:

• Provide, maintain, and improve our services
• Process and rank resumes using our AI models
• Send you technical notices and support messages
• Respond to your comments and questions
• Monitor and analyse trends and usage of our services
• Detect and prevent fraudulent transactions and other illegal activities

We do not sell your personal information to third parties.`,
  },
  {
    title: '3. Data processing and AI',
    content: `When you upload resume files, our AI systems process the document text to generate structured candidate profiles and relevance scores. This processing occurs on our secure infrastructure.

Candidate data is:
• Processed only for the purposes you instruct
• Not used to train our global AI models without explicit consent
• Retained for the duration of your account plus 30 days after deletion requests
• Subject to the right to erasure upon request`,
  },
  {
    title: '4. Information sharing',
    content: `We may share your information with:

• Service providers who assist in our operations (cloud hosting, email delivery)
• Professional advisors (lawyers, accountants) under confidentiality obligations
• Law enforcement when required by law

We require all third-party service providers to maintain appropriate security measures and prohibit them from using your data for their own purposes.`,
  },
  {
    title: '5. Data security',
    content: `We implement industry-standard security measures including:

• AES-256 encryption for data at rest
• TLS 1.3 for all data in transit
• Role-based access controls
• Regular security audits and penetration testing
• SOC 2 Type II compliant infrastructure

No system is completely secure. If you believe there has been a breach, contact security@srpailabs.com immediately.`,
  },
  {
    title: '6. Your rights (GDPR & CCPA)',
    content: `Depending on your location, you may have the right to:

• Access the personal data we hold about you
• Correct inaccurate personal data
• Request deletion of your personal data
• Object to or restrict processing of your personal data
• Data portability (receive your data in a machine-readable format)
• Withdraw consent at any time

To exercise these rights, email privacy@srpailabs.com. We will respond within 30 days.`,
  },
  {
    title: '7. Cookies and tracking',
    content: `We use cookies and similar tracking technologies to operate our services. These include:

• Essential cookies (required for authentication and security)
• Analytics cookies (to understand usage patterns — you can opt out)
• Preference cookies (to remember your settings)

You can control cookies through your browser settings. Disabling essential cookies may affect service functionality.`,
  },
  {
    title: '8. Data retention',
    content: `We retain your data for as long as your account is active or as needed to provide services. Upon account termination:

• Account data is deleted within 30 days
• Backup copies are purged within 90 days
• Anonymised analytics data may be retained indefinitely

You can request immediate deletion by contacting privacy@srpailabs.com.`,
  },
  {
    title: '9. Changes to this policy',
    content: `We may update this Privacy Policy from time to time. We will notify you of significant changes by email or by posting a notice on our platform. Continued use of our services after changes become effective constitutes acceptance of the revised policy.`,
  },
  {
    title: '10. Contact us',
    content: `If you have questions about this Privacy Policy or our data practices:

Email: privacy@srpailabs.com
Address: SRP Recruit AI Labs Pvt. Ltd., India

For EU/EEA residents, our EU representative can be reached at: eu-gdpr@srpailabs.com`,
  },
]

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#07070e] pt-16">
        <section className="border-b border-white/5 py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 mb-4">Legal</span>
            <h1 className="text-4xl font-bold text-white mb-3">Privacy Policy</h1>
            <p className="text-gray-500 text-sm">Last updated: June 15, 2025 · Effective: June 15, 2025</p>
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-indigo-500/8 border border-indigo-500/20 rounded-xl p-5 mb-10">
            <p className="text-indigo-300 text-sm leading-relaxed">
              SRP Recruit AI Labs ("SRP", "we", "us", "our") operates the SRP Recruit AI platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our services. Please read this policy carefully.
            </p>
          </div>

          <div className="space-y-8">
            {sections.map((s) => (
              <div key={s.title} className="border-b border-white/5 pb-8 last:border-0">
                <h2 className="text-white font-semibold text-lg mb-3">{s.title}</h2>
                <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">{s.content}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
