import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const sections = [
  {
    title: '1. Acceptance of terms',
    content: `By accessing or using the SRP Recruit AI platform ("Service"), you agree to be bound by these Terms of Use ("Terms"). If you do not agree to these Terms, do not use the Service.

These Terms apply to all users of the Service including companies, individual recruiters, administrators, and any other persons accessing the platform.`,
  },
  {
    title: '2. Description of service',
    content: `SRP Recruit AI Labs provides an AI-powered talent acquisition platform that enables organisations to:

• Post job openings and manage hiring pipelines
• Upload and process candidate resumes using AI models
• Score, rank, and filter candidates based on job requirements
• Automate outreach and candidate communication
• Access talent analytics and reporting

The Service is provided on a subscription basis. Feature availability depends on your subscription plan.`,
  },
  {
    title: '3. Account registration',
    content: `To use the Service, you must register for an account. You agree to:

• Provide accurate, complete, and current registration information
• Maintain the security of your password and accept responsibility for all activity under your account
• Promptly notify us of any unauthorised use of your account
• Not share your account credentials with any third party

You must be at least 18 years old and authorised by your organisation to bind it to these Terms.`,
  },
  {
    title: '4. Acceptable use',
    content: `You agree NOT to use the Service to:

• Violate any applicable laws or regulations
• Discriminate against candidates on the basis of protected characteristics
• Upload malicious content, viruses, or harmful code
• Attempt to gain unauthorised access to any part of the Service
• Scrape, crawl, or data-mine the Service without authorisation
• Use the Service to send unsolicited communications (spam)
• Misrepresent your identity or affiliation
• Use candidate data for purposes other than legitimate hiring

We reserve the right to suspend or terminate accounts that violate these terms without notice.`,
  },
  {
    title: '5. Data ownership and licensing',
    content: `You retain ownership of all data you submit to the Service ("Customer Data"). By using the Service, you grant SRP a limited, non-exclusive, worldwide licence to process your Customer Data solely to provide and improve the Service.

SRP does not claim ownership of your Customer Data and will not use it for any purpose other than providing services to you, as described in our Privacy Policy.`,
  },
  {
    title: '6. AI and automated decisions',
    content: `Our platform uses artificial intelligence and machine learning to provide candidate scoring and recommendations. You acknowledge that:

• AI scores are provided as recommendations only and do not constitute final hiring decisions
• You remain solely responsible for all hiring decisions made using or assisted by the Service
• You should apply human judgement and comply with applicable employment laws when making hiring decisions
• AI scoring may not be perfect and should be used as one input among many`,
  },
  {
    title: '7. Payment and subscriptions',
    content: `Paid subscriptions are billed in advance on a monthly or annual basis. You agree to:

• Pay all fees associated with your chosen plan
• Provide valid payment information and keep it current
• Notify us of billing disputes within 30 days of the charge

Refunds are provided within 14 days of initial purchase for annual plans. Monthly plans are non-refundable. We reserve the right to modify pricing with 30 days' notice.`,
  },
  {
    title: '8. Intellectual property',
    content: `The Service, including its software, design, trademarks, AI models, and documentation, is owned by SRP Recruit AI Labs and protected by intellectual property laws. You receive a limited, non-exclusive, non-transferable licence to use the Service during your subscription.

You may not copy, modify, reverse engineer, or create derivative works of the Service or any part thereof.`,
  },
  {
    title: '9. Disclaimer of warranties',
    content: `THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. SRP DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.`,
  },
  {
    title: '10. Limitation of liability',
    content: `TO THE MAXIMUM EXTENT PERMITTED BY LAW, SRP SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS OR DATA.

OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING UNDER THESE TERMS SHALL NOT EXCEED THE AMOUNTS PAID BY YOU TO SRP IN THE 12 MONTHS PRECEDING THE CLAIM.`,
  },
  {
    title: '11. Governing law',
    content: `These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts of Hyderabad, Telangana, India.`,
  },
  {
    title: '12. Contact',
    content: `For questions about these Terms: legal@srpailabs.com`,
  },
]

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#07070e] pt-16">
        <section className="border-b border-white/5 py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 mb-4">Legal</span>
            <h1 className="text-4xl font-bold text-white mb-3">Terms of Use</h1>
            <p className="text-gray-500 text-sm">Last updated: June 15, 2025 · Effective: June 15, 2025</p>
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
