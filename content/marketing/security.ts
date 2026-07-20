/** Security & trust copy — truthful wording only. */

export const SECURITY_PAGE = {
  meta: {
    title: 'Security & Data Protection | SRP Recruit AI',
    description:
      'How SRP Recruit AI is designed to support secure candidate data handling, role-based access, and audit trails.',
  },
  hero: {
    eyebrow: 'Security & trust',
    title: 'Candidate data deserves careful handling.',
    subtitle:
      'We design for workspace isolation, access controls, and operational accountability — without claiming certifications we have not verified.',
  },
  pillars: [
    {
      title: 'Data protection practices',
      items: [
        'Tenant-scoped workspaces so agency data stays separated',
        'Encrypted connections for data in transit (TLS)',
        'Designed to support secure storage of candidate profiles',
        'Regular review of access and operational practices',
      ],
    },
    {
      title: 'Access controls',
      items: [
        'Role-based access for owners, admins, recruiters, and viewers',
        'Principle of least privilege for internal operations',
        'Authentication required for workspace access',
        'Admin actions designed to be auditable',
      ],
    },
    {
      title: 'Operational accountability',
      items: [
        'Activity logging for screening and profile changes',
        'Human review before client-facing submissions',
        'Support access gated behind formal approval when needed',
        'Responsible disclosure channel for security reports',
      ],
    },
    {
      title: 'Privacy alignment',
      items: [
        'Designed to support responsible handling of candidate data',
        'Data processing practices described in our Privacy Policy',
        'Contact us for data protection questions or DPA requests',
        'AI outputs are recommendations — hiring decisions stay with humans',
      ],
    },
  ],
  faqs: [
    {
      q: 'Where is candidate data stored?',
      a: 'Data is stored on infrastructure we operate for the platform. Contact us for current hosting region details and data residency questions.',
    },
    {
      q: 'Can SRP staff access my candidate data?',
      a: 'Support access is limited and gated. We do not routinely browse customer candidate data without a documented support request and approval.',
    },
    {
      q: 'How does AI fit into compliance conversations?',
      a: 'Our AI assists recruiters with screening and explanations. Final hiring and submission decisions remain with your team, with human review built into the workflow.',
    },
    {
      q: 'How do I report a security concern?',
      a: 'Email security@srpailabs.com with details. We acknowledge reports promptly and investigate validated findings.',
    },
  ],
  contact: {
    title: 'Report a vulnerability',
    email: 'security@srpailabs.com',
    note: 'We appreciate responsible disclosure and will work with researchers on validated findings.',
  },
} as const
