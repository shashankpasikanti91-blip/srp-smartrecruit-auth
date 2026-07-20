/** Contact / demo page copy. */

export const CONTACT_PAGE = {
  meta: {
    title: 'Contact & Demo | SRP Recruit AI',
    description: 'Book a demo or contact our team about SRP Recruit AI for recruitment agencies.',
  },
  hero: {
    eyebrow: 'Contact & demo',
    title: 'See how agencies turn resume volume into ranked shortlists.',
    subtitle:
      'Book a walkthrough tailored to your desk size, client mix, and screening workflow. No pressure — just a clear look at the platform.',
  },
  demoBenefits: [
    'Live walkthrough of bulk screening and AI match explanations',
    'Discussion of your agency workflow and client submission process',
    'Guidance on plans for your team size and screening volume',
    'Q&A on data handling, access controls, and human review',
  ],
  options: [
    {
      title: 'Book a demo',
      description: '30-minute session with our team — tailored to agency recruiting workflows.',
      cta: 'Schedule via form',
      accent: 'cyan',
    },
    {
      title: 'Talk to sales',
      description: 'Questions about Professional or Enterprise plans, seats, or onboarding.',
      cta: 'Select sales enquiry',
      accent: 'violet',
    },
    {
      title: 'Email directly',
      description: 'Reach us at support@srpailabs.com — we respond within one business day.',
      cta: 'support@srpailabs.com',
      accent: 'emerald',
    },
  ],
  subjects: [
    'Agency demo request',
    'Professional / Enterprise pricing',
    'Integration question',
    'Partnership opportunity',
    'Data protection question',
    'Other',
  ],
} as const
