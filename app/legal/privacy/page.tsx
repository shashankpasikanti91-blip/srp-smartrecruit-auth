import type { Metadata } from 'next'
import MarketingLayout from '@/components/marketing/MarketingLayout'
import LegalPageShell from '@/components/marketing/ui/LegalPageShell'

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
    content: `When you upload resume files, our AI systems process the document text to generate structured candidate profiles and relevance scores. This processing occurs on our infrastructure.

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

We require third-party service providers to maintain appropriate security measures and prohibit them from using your data for their own purposes.`,
  },
  {
    title: '5. Data security',
    content: `We implement security measures designed to protect candidate and account data, including:

• TLS encryption for data in transit
• Role-based access controls
• Workspace isolation per agency
• Activity logging for operational accountability

No system is completely secure. If you believe there has been a breach, contact security@srpailabs.com immediately.`,
  },
  {
    title: '6. Your privacy rights',
    content: `Depending on your location, you may have rights to access, correct, delete, or restrict processing of your personal data, or to request portability.

To exercise these rights, email privacy@srpailabs.com. We will respond within a reasonable timeframe.`,
  },
  {
    title: '7. Cookies and tracking',
    content: `We use cookies and similar technologies to operate our services, including essential cookies for authentication and optional analytics cookies. You can control cookies through your browser settings.`,
  },
  {
    title: '8. Data retention',
    content: `We retain your data for as long as your account is active or as needed to provide services. Upon account termination, account data is deleted within 30 days unless a longer retention period is required by law.`,
  },
  {
    title: '9. Changes to this policy',
    content: `We may update this Privacy Policy from time to time. We will notify you of significant changes by email or by posting a notice on our platform.`,
  },
  {
    title: '10. Contact us',
    content: `Questions about this Privacy Policy: privacy@srpailabs.com`,
  },
]

export const metadata: Metadata = {
  title: 'Privacy Policy | SRP Recruit AI',
  description: 'How SRP Recruit AI collects, uses, and protects personal and candidate data.',
}

export default function PrivacyPage() {
  return (
    <MarketingLayout>
      <LegalPageShell
        eyebrow="Legal"
        title="Privacy Policy"
        subtitle="Last updated: June 15, 2025 · How we handle personal and candidate data."
      >
        <p className="marketing-glass rounded-xl p-5 border border-cyan-500/15 text-sm text-slate-300 mb-10 not-prose">
          SRP Recruit AI (&ldquo;SRP&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) operates the SRP Recruit AI platform.
          This policy explains how we collect, use, and safeguard information when you use our services.
        </p>
        {sections.map((s) => (
          <div key={s.title} className="mb-8 not-prose">
            <h2 className="text-white font-semibold text-lg mb-3">{s.title}</h2>
            <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-line">{s.content}</p>
          </div>
        ))}
      </LegalPageShell>
    </MarketingLayout>
  )
}
