/** Features page — agency-focused capability copy. */

export const FEATURES_PAGE = {
  meta: {
    title: 'Features | SRP Recruit AI',
    description:
      'Bulk resume screening, AI candidate matching, duplicate detection, and client-ready shortlists — built for recruitment agencies.',
  },
  hero: {
    eyebrow: 'Platform features',
    title: 'Turn resume overload into ranked, review-ready shortlists.',
    subtitle:
      'SRP Recruit AI helps recruitment agencies screen CVs, compare candidates, explain fit, and prepare recruiter-reviewed shortlists for client submission.',
  },
  bento: [
    {
      id: 'bulk-screening',
      title: 'Bulk resume screening',
      description:
        'Upload large CV batches per job. AI reads each profile, extracts skills and experience, and surfaces candidates worth recruiter review first.',
      visual: '/marketing/recruit-ai/resume-ai-flow.svg',
      visualAlt: 'Resume upload through parse, match, and shortlist flow diagram',
      span: 'large' as const,
      accent: 'cyan',
    },
    {
      id: 'matching',
      title: 'AI candidate matching',
      description:
        'Score fit against required skills, years of experience, and optional criteria — with structured explanations recruiters can validate.',
      visual: '/marketing/recruit-ai/match-score-ring.svg',
      visualAlt: 'Circular AI match score ring showing candidate fit percentage',
      span: 'default' as const,
      accent: 'violet',
    },
    {
      id: 'extraction',
      title: 'Skill & experience extraction',
      description:
        'Parse employment history, certifications, and skill tags from unstructured resumes into consistent recruiter-readable profiles.',
      span: 'default' as const,
      accent: 'emerald',
    },
    {
      id: 'duplicates',
      title: 'Duplicate candidate detection',
      description:
        'Flag repeated profiles across roles and clients within your workspace so recruiters work from one trusted record.',
      span: 'default' as const,
      accent: 'cyan',
    },
    {
      id: 'ranking',
      title: 'Candidate ranking with explanation',
      description:
        'Ranked lists include strengths, gaps, and review notes — not opaque scores. Recruiters understand why a profile surfaced.',
      visual: '/marketing/recruit-ai/candidate-ranking-panel.svg',
      visualAlt: 'Candidate ranking dashboard with score rings and explanation chips',
      span: 'large' as const,
      accent: 'violet',
    },
    {
      id: 'shortlist',
      title: 'Client-ready shortlist preparation',
      description:
        'Package shortlisted candidates with scores and recruiter notes into submission-ready packs for hiring managers and clients.',
      visual: '/marketing/recruit-ai/client-shortlist-preview.svg',
      visualAlt: 'Client submission pack preview with candidate profile cards',
      span: 'default' as const,
      accent: 'emerald',
    },
    {
      id: 'pipeline',
      title: 'Recruiter pipeline management',
      description:
        'Move candidates through applied, screening, interview, offer, and placed stages on a visual board built for agency workflows.',
      span: 'default' as const,
      accent: 'cyan',
    },
    {
      id: 'reports',
      title: 'Reports & hiring insights',
      description:
        'Track screening activity, stage counts, and pipeline health across jobs — designed to support operational reviews, not replace judgment.',
      span: 'default' as const,
      accent: 'violet',
    },
    {
      id: 'human-review',
      title: 'Human review before final decision',
      description:
        'AI helps recruiters prioritize and explain — your team approves what advances and what goes to clients.',
      span: 'default' as const,
      accent: 'emerald',
    },
  ],
  sticky: {
    eyebrow: 'How recruiters use it',
    title: 'From inbox chaos to a defensible shortlist',
    steps: [
      { label: 'Ingest', detail: 'Bulk upload resumes or add candidates per job opening.' },
      { label: 'Screen', detail: 'AI extracts skills, flags duplicates, and ranks against JD criteria.' },
      { label: 'Review', detail: 'Recruiters validate scores, add notes, and adjust priority.' },
      { label: 'Submit', detail: 'Prepare client-ready packs with explanations attached.' },
    ],
  },
  cta: {
    title: 'Explore features in a live walkthrough',
    subtitle: 'See how agency teams screen, rank, and submit candidates with human oversight.',
    primary: { label: 'Book a demo', href: '/support/contact' },
    secondary: { label: 'View platform', href: '/platform' },
  },
} as const
