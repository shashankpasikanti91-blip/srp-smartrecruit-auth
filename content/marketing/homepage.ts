/** Homepage content — single source of truth for anchors, copy, and pricing. */

export const HOMEPAGE_ANCHORS = {
  painPoints: 'desk',
  workflow: 'week',
  modules: 'product',
  preview: 'product',
  agentic: 'signoff',
  trust: 'signoff',
  pricing: 'pricing',
  features: 'product',
  howItWorks: 'week',
} as const

export const HERO = {
  kicker: 'SRP AI Labs',
  title: 'SmartRecruit',
  titleLines: {
    desktop: ['SmartRecruit'],
    mobile: ['SmartRecruit'],
  },
  lede:
    'Screen CVs against the job brief, keep the reason on the record, and send only the names you will stand behind.',
  ctaPrimary: { label: 'Open workspace', href: '/login' },
  ctaSecondary: { label: 'See pricing', href: '/#pricing' },
  eyebrow: 'SRP AI Labs',
  subtitle:
    'Screen CVs against the job brief, keep the reason on the record, and send only the names you will stand behind.',
  trustChips: [] as readonly string[],
} as const

export const SCROLL_STORY = {
  eyebrow: 'Editorial workflow',
  title: 'From 500 CVs to a focused shortlist.',
  subtitle:
    'When volume spikes across clients and roles, recruiters need ranked profiles with clear reasons — not another folder of PDFs.',
  points: [
    'AI reads and structures every CV against job criteria',
    'Recruiters review explanations before advancing candidates',
    'Client-ready packs prepared with scores and recruiter notes',
  ],
} as const

export const AGENCY_OPS = {
  eyebrow: 'Agency reality',
  title: 'Built for agencies managing multiple clients, urgent openings, and high resume volume.',
  subtitle:
    'The pressure is not finding candidates — it is comparing hundreds of profiles under deadline with no consistent match explanation.',
  alerts: [
    '500+ CVs received for a single urgent role',
    'Same candidate profile appears across client jobs',
    'Client submission deadline in 48 hours',
    'Notes scattered across email, spreadsheets, and drives',
    'No clear explanation for why a profile ranked higher',
  ],
} as const

export const STICKY_STORY = {
  eyebrow: 'Product workflow',
  title: 'Move from CV upload to client-ready shortlist — with recruiters in control.',
  steps: [
    { id: 'upload', label: 'Upload', description: 'Ingest bulk CV batches or add candidates per job opening across client workspaces.' },
    { id: 'parse', label: 'Parse', description: 'Extract skills, experience, certifications, and employment history into structured recruiter-readable profiles.' },
    { id: 'match', label: 'Match', description: 'Rank candidates against required and optional job criteria with explainable fit scores.' },
    { id: 'explain', label: 'Explain', description: 'Every ranking includes strengths, gaps, and review notes recruiters can validate.' },
    { id: 'review', label: 'Review', description: 'Recruiters approve, adjust priority, or hold profiles before client-facing submission.' },
    { id: 'submit', label: 'Submit', description: 'Package shortlisted candidates into submission-ready packs for hiring managers and clients.' },
  ],
} as const

export const MODULES_SECTION = {
  eyebrow: 'Platform capabilities',
  title: 'Built for agency hiring desks.',
  subtitle:
    'Everything is organized around the way recruiters screen, compare, review, and submit candidates for clients.',
} as const

export const AGENCY_MODULES = [
  {
    id: 'bulk-screening',
    title: 'Bulk CV Screening',
    description: 'Upload CV batches and quickly surface candidates that match each role.',
    visual: 'pipeline' as const,
    layout: 'feature' as const,
  },
  {
    id: 'matching',
    title: 'Candidate Matching',
    description: 'Compare skills, experience, and role requirements with clear match signals.',
    visual: 'ring' as const,
    layout: 'orbit-tl' as const,
  },
  {
    id: 'fit-explanation',
    title: 'Fit Explanation',
    description: 'See why a candidate may fit, what is missing, and what to review next.',
    visual: 'explain' as const,
    layout: 'orbit-tr' as const,
  },
  {
    id: 'duplicate-checks',
    title: 'Duplicate Checks',
    description: 'Flag repeated profiles and possible duplicate submissions before they reach the client.',
    visual: 'duplicate' as const,
    layout: 'orbit-bl' as const,
  },
  {
    id: 'submission-pack',
    title: 'Client Submission Pack',
    description: 'Prepare shortlisted candidates with notes, scores, and review status.',
    visual: 'submission' as const,
    layout: 'orbit-br' as const,
  },
  {
    id: 'pipeline-board',
    title: 'Pipeline Board',
    description: 'Track candidates from screening to review, submission, and placement.',
    visual: 'kanban' as const,
    layout: 'rail' as const,
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'View screening activity, shortlist progress, and desk-level hiring insights.',
    visual: 'chart' as const,
    layout: 'rail' as const,
  },
  {
    id: 'audit-trail',
    title: 'Audit Trail',
    description: 'Keep recruiter actions and review activity visible for accountability.',
    visual: 'audit' as const,
    layout: 'rail' as const,
  },
] as const

/** @deprecated Use AGENCY_MODULES */
export const BENTO_MODULES = [
  { title: 'Bulk Resume Intelligence', description: 'Process large CV batches and surface ranked candidates per job requirement.', size: 'large', visual: 'pipeline' },
  { title: 'Job-Candidate Matching', description: 'Score fit against required skills, experience, and optional criteria.', size: 'wide', visual: 'ring' },
  { title: 'Client Submission Pack', description: 'Organize shortlisted profiles with scores and notes for client handoff.', size: 'tall', visual: 'chips' },
  { title: 'Duplicate Detection', description: 'Flag repeated profiles within your agency workspace.', size: 'small', visual: 'comment' },
  { title: 'Reports & Analytics', description: 'Pipeline health, stage counts, and screening activity.', size: 'small', visual: 'chart' },
  { title: 'Audit Trail', description: 'Activity logs for accountable recruiting operations.', size: 'small', visual: 'comment' },
  { title: 'Pipeline Board', description: 'Visual Kanban from applied through placed.', size: 'small', visual: 'pipeline' },
] as const

export const JOURNEY = {
  eyebrow: 'Agency journey',
  title: 'Source → Screen → Rank → Review → Submit → Track',
  stages: ['Source', 'Screen', 'Rank', 'Review', 'Submit', 'Track'],
} as const

export const HUMAN_REVIEW = {
  eyebrow: 'Responsible AI',
  title: 'AI recommends. Recruiters decide.',
  subtitle:
    'AI assists with screening, ranking, prioritizing, and explaining candidate fit — final hiring and submission decisions stay with your team.',
  points: [
    { title: 'Assist, not automate', description: 'AI drafts screening insights; recruiters validate before advancing candidates.' },
    { title: 'Explainable rankings', description: 'Scores link to skills matched, gaps identified, and experience checks.' },
    { title: 'Client-ready oversight', description: 'Nothing goes to clients without recruiter review and approval.' },
  ],
} as const

export const TRUST = {
  eyebrow: 'Security & trust',
  title: 'Designed to support controlled access and accountable recruiting workflows.',
  subtitle:
    'Candidate data protection, workspace isolation, and human review — without unsupported certification claims.',
  items: [
    { title: 'Candidate data protection', description: 'Tenant-scoped workspaces so each agency\'s data stays separated.' },
    { title: 'Role-based access', description: 'Owner, admin, recruiter, and viewer permissions per workspace.' },
    { title: 'Audit logs', description: 'Track screening and profile activity for operational accountability.' },
    { title: 'Human review', description: 'AI recommendations are reviewed before client submission.' },
  ],
} as const

export const PRICING = {
  eyebrow: 'Pricing',
  title: 'Recruitment OS pricing that matches AI + pipeline depth.',
  subtitle:
    'Priced for agency desks — not a toy scanner. INR list prices; USD guide in parentheses. Billing is confirmed manually until card checkout ships.',
  currencyNote: 'Listed in INR. Guide USD ≈ ₹83. Annual invoicing available on Professional and Agency (2 months free).',
  plans: [
    {
      name: 'Starter',
      price: '₹0',
      priceUsd: '$0',
      period: 'forever',
      description: 'Evaluate the workspace with real jobs and light AI screening.',
      features: [
        '5 active job posts',
        '50 AI screens / month',
        '1 user seat',
        'Job 360 & Candidate 360',
        'Manual resume upload (PDF/DOCX)',
        'AI ranking with explanations',
        '14-day activity history',
        'Email support',
      ],
      cta: 'Start free',
      ctaHref: '/login',
      highlighted: false,
      planKey: 'free',
    },
    {
      name: 'Professional',
      price: '₹9,999',
      priceUsd: '$119',
      period: 'per month',
      description: 'Solo desks and small teams running daily screening + pipeline.',
      features: [
        'Unlimited active job posts',
        '1,000 AI screens / month',
        '5 user seats',
        'Bulk CV upload & queue',
        'AI Hub (screen, boolean, compose, JD)',
        'Deep RAG match explanations',
        'Communications (email / Telegram)',
        '90-day history + audit trail',
        'Priority email support',
      ],
      cta: 'Upgrade to Professional',
      ctaHref: '/support/contact?plan=professional',
      highlighted: false,
      planKey: 'pro',
    },
    {
      name: 'Agency',
      price: '₹24,999',
      priceUsd: '$299',
      period: 'per month',
      description: 'Multi-recruiter agencies with high volume and client desks.',
      features: [
        'Everything in Professional',
        'Unlimited AI screens',
        '15 user seats',
        'Recruiters module & governance views',
        'Analytics / reports packs',
        'WhatsApp Business (Meta) when configured',
        'Dedicated onboarding call',
        'Named success contact',
      ],
      cta: 'Talk to sales',
      ctaHref: '/support/contact?plan=agency',
      highlighted: true,
      planKey: 'pro',
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      priceUsd: 'Custom',
      period: 'annual MSA',
      description: 'Multi-tenant orgs, SSO, residency, and contracted SLAs.',
      features: [
        'Unlimited users & screens',
        'SSO / SAML (roadmap by contract)',
        'Custom integrations',
        'Data residency & DPA',
        'Custom SLA & invoiced billing',
        'White-label options',
        'Dedicated Customer Success',
      ],
      cta: 'Contact sales',
      ctaHref: '/support/contact?plan=enterprise',
      highlighted: false,
      planKey: 'enterprise',
    },
  ],
} as const

export const FINAL_CTA = {
  title: 'Build your next shortlist with AI-assisted recruitment intelligence.',
  subtitle:
    'AI-ranked shortlists with clear reasons recruiters can review — built for agency workflows with human oversight.',
  primary: { label: 'Start Free', href: '/login' },
  secondary: { label: 'Contact Sales', href: '/support/contact' },
} as const

export const PREVIEW = {
  eyebrow: 'Command center',
  title: 'Your recruitment intelligence hub — visual mockup.',
  subtitle: 'Illustrative UI showing ranked candidates, fit explanations, pipeline stages, and client submission packs.',
} as const

// Legacy exports for deprecated section components still in repo
export const PAIN_POINTS = {
  eyebrow: AGENCY_OPS.eyebrow,
  title: AGENCY_OPS.title,
  subtitle: AGENCY_OPS.subtitle,
  items: AGENCY_OPS.alerts.map((alert) => ({ title: alert, description: '' })),
}
export const WORKFLOW = {
  eyebrow: JOURNEY.eyebrow,
  title: JOURNEY.title,
  subtitle: '',
  stages: JOURNEY.stages.map((label) => ({ id: label.toLowerCase(), label, description: '' })),
}
export const PRODUCT_MODULES = {
  eyebrow: 'Platform modules',
  title: 'Every module supports agency recruiters.',
  subtitle: '',
  items: BENTO_MODULES.map((m) => ({ title: m.title, description: m.description, span: m.size === 'large' ? 'large' as const : 'default' as const })),
}
export const AGENTIC = HUMAN_REVIEW
