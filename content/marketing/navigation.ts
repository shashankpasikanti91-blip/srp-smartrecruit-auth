/** Shared marketing navigation — single source for header/footer. */

export const MARKETING_ROUTES = {
  home: '/',
  product: '/features',
  features: '/features',
  platform: '/platform',
  solutions: '/solutions',
  pricing: '/pricing',
  security: '/legal/security',
  contact: '/support/contact',
  about: '/company/about',
  privacy: '/legal/privacy',
  terms: '/legal/terms',
  login: '/login',
  signup: '/signup',
} as const

export const HEADER_NAV = [
  { label: 'Product', href: MARKETING_ROUTES.product },
  { label: 'Platform', href: MARKETING_ROUTES.platform },
  { label: 'Solutions', href: MARKETING_ROUTES.solutions },
  { label: 'Pricing', href: MARKETING_ROUTES.pricing },
  { label: 'Security', href: MARKETING_ROUTES.security },
  { label: 'Contact', href: MARKETING_ROUTES.contact },
] as const

export const FOOTER_PRODUCT = [
  { label: 'Resume Screening', href: '/features#bulk-screening' },
  { label: 'AI Matching', href: '/features#matching' },
  { label: 'Candidate Pipeline', href: '/platform#pipeline-board' },
  { label: 'Reports', href: '/platform#analytics' },
] as const

export const FOOTER_COMPANY = [
  { label: 'About', href: MARKETING_ROUTES.about },
  { label: 'Contact', href: MARKETING_ROUTES.contact },
  { label: 'Pricing', href: MARKETING_ROUTES.pricing },
] as const

export const FOOTER_LEGAL = [
  { label: 'Privacy', href: MARKETING_ROUTES.privacy },
  { label: 'Terms', href: MARKETING_ROUTES.terms },
  { label: 'Security', href: MARKETING_ROUTES.security },
] as const
