/** Platform page — command center narrative. */

export const PLATFORM_PAGE = {
  meta: {
    title: 'Platform | SRP Recruit AI',
    description:
      'A recruitment command center for resume intelligence, matching, pipeline boards, analytics, and recruiter workspace.',
  },
  hero: {
    eyebrow: 'Platform overview',
    title: 'One command center for agency hiring operations.',
    subtitle:
      'Resume intelligence, candidate matching, pipeline tracking, and reporting — organized for recruiters managing multiple clients and urgent roles.',
  },
  zones: [
    {
      id: 'resume-intelligence',
      title: 'Resume intelligence',
      description:
        'Ingest bulk CVs, extract structured skills and experience, and surface profiles that meet must-have requirements — before recruiters open every PDF manually.',
      chips: ['Bulk upload', 'Skill tags', 'Experience parse', 'Gap flags'],
    },
    {
      id: 'matching-engine',
      title: 'Matching engine',
      description:
        'Rank candidates against job descriptions with explainable scores. See which requirements are met, which are partial, and what needs human verification.',
      chips: ['JD criteria', 'Fit scores', 'Strengths', 'Review notes'],
    },
    {
      id: 'pipeline-board',
      title: 'Pipeline board',
      description:
        'Track every candidate from applied through placed on a Kanban-style board. Move profiles between stages with full activity context.',
      chips: ['Kanban stages', 'Recruiter tasks', 'Client roles', 'Status history'],
    },
    {
      id: 'analytics',
      title: 'Analytics & insights',
      description:
        'Monitor screening volume, stage distribution, and recruiter activity. Built to support weekly reviews — not to automate hiring decisions.',
      chips: ['Stage counts', 'Screening logs', 'Job health', 'Team activity'],
    },
    {
      id: 'workspace',
      title: 'Recruiter workspace',
      description:
        'Role-based access, audit trails, and tenant-scoped data so each agency workspace stays isolated and accountable.',
      chips: ['RBAC', 'Audit trail', 'Tenant isolation', 'Human approval'],
    },
  ],
  cta: {
    title: 'See the platform configured for your agency',
    subtitle: 'Walk through resume screening, matching, and pipeline workflows with our team.',
    primary: { label: 'Book a demo', href: '/support/contact' },
    secondary: { label: 'Compare plans', href: '/pricing' },
  },
} as const
