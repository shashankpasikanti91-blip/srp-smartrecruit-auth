import type { Metadata } from 'next'
import MarketingLayout from '@/components/marketing/MarketingLayout'
import LegalPageShell from '@/components/marketing/ui/LegalPageShell'
import { SUBPAGES } from '@/content/marketing/subpages'

const sections = [
  {
    title: '1. Acceptance of terms',
    content: `By accessing or using the SRP Recruit AI platform ("Service"), you agree to be bound by these Terms of Use ("Terms"). If you do not agree to these Terms, do not use the Service.`,
  },
  {
    title: '2. Description of service',
    content: `SRP Recruit AI Labs provides an AI-assisted talent acquisition platform that enables organisations to:

• Post job openings and manage hiring pipelines
• Upload and process candidate resumes using AI models
• Score, rank, and filter candidates based on job requirements
• Support recruiter outreach and candidate communication
• Access talent analytics and reporting

The Service is provided on a subscription basis. Feature availability depends on your subscription plan.`,
  },
  {
    title: '3. Account registration',
    content: `To use the Service, you must register for an account. You agree to provide accurate information, maintain account security, and notify us of unauthorised use. You must be at least 18 years old and authorised by your organisation to bind it to these Terms.`,
  },
  {
    title: '4. Acceptable use',
    content: `You agree not to use the Service to violate laws, discriminate unlawfully, upload malicious content, gain unauthorised access, scrape without permission, send spam, or misuse candidate data. We may suspend accounts that violate these terms.`,
  },
  {
    title: '5. Data ownership and licensing',
    content: `You retain ownership of Customer Data. You grant SRP a limited licence to process Customer Data solely to provide and improve the Service, as described in our Privacy Policy.`,
  },
  {
    title: '6. AI and automated decisions',
    content: `AI scores are recommendations only. You remain responsible for hiring decisions, human review, and compliance with applicable employment laws. SRP is not liable for employment outcomes arising from use of the Service.`,
  },
  {
    title: '7. Third-party portal integrations',
    content: `Portal integrations are subject to each provider's terms. You must hold valid subscriptions and use portal-sourced data only for legitimate hiring purposes.`,
  },
  {
    title: '8. API access',
    content: `Eligible plans may access the REST API. Keep keys confidential, respect rate limits, and notify us of compromised credentials.`,
  },
  {
    title: '9. Payment and subscriptions',
    content: `Paid plans are billed in advance. Fees, refunds, and pricing changes are as described at purchase and may be updated with notice.`,
  },
  {
    title: '10. Limitation of liability',
    content: `THE SERVICE IS PROVIDED "AS IS". TO THE MAXIMUM EXTENT PERMITTED BY LAW, SRP'S LIABILITY IS LIMITED TO AMOUNTS PAID IN THE 12 MONTHS PRECEDING A CLAIM.`,
  },
  {
    title: '11. Contact',
    content: `For questions about these Terms: legal@srpailabs.com`,
  },
]

export const metadata: Metadata = {
  title: 'Terms of Use | SRP Recruit AI',
  description: SUBPAGES.terms.subtitle,
}

export default function TermsPage() {
  return (
    <MarketingLayout>
      <LegalPageShell eyebrow={SUBPAGES.terms.eyebrow} title={SUBPAGES.terms.title} subtitle="Last updated: June 15, 2025">
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
