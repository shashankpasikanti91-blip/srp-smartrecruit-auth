/** Solutions page — agency use-case editorial content. */

export const SOLUTIONS_PAGE = {
  meta: {
    title: 'Solutions | SRP Recruit AI',
    description: 'Recruitment agency solutions for bulk CV screening, client submissions, and multi-desk hiring workflows.',
  },
  hero: {
    eyebrow: 'Solutions for agencies',
    title: 'Every urgent role deserves a defensible shortlist.',
    subtitle:
      'SRP Recruit AI supports the workflows recruitment agencies run every day — high CV volume, multiple clients, and tight submission deadlines.',
  },
  scrollyBlocks: [
    {
      id: 'multi-client-desk',
      heading: 'Multi-client desk operations',
      body: 'Manage screening across client workspaces without mixing candidate data. Each workspace stays organized with role-based access and clear review stages.',
      action: { label: 'View workflow', href: '/features#workflow' },
      imageSide: 'left' as const,
      visual: 'agencyCommandCenter' as const,
    },
    {
      id: 'match-explain',
      heading: 'Every match should explain itself',
      body: 'See why a candidate fits, where they may fall short, and what recruiters should review before submitting.',
      action: { label: 'View matching', href: '/features#matching' },
      imageSide: 'right' as const,
      visual: 'matchExplanation' as const,
    },
    {
      id: 'client-shortlist',
      heading: 'Shortlists prepared for client review',
      body: 'Convert ranked candidates into clean submission packs with notes, fit reasons, and recruiter review status.',
      action: { label: 'View shortlist', href: '/features#submission-pack' },
      imageSide: 'left' as const,
      visual: 'clientSubmission' as const,
    },
  ],
  cta: {
    title: 'See how your agency workflow maps to the platform',
    subtitle: 'Book a walkthrough tailored to your desk size and client mix.',
    primary: { label: 'Book a demo', href: '/support/contact' },
    secondary: { label: 'View platform', href: '/platform' },
  },
} as const
