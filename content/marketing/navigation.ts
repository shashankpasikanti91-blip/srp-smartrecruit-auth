/** Shared marketing navigation — one-page hash links on `/`. */

export const MARKETING_ROUTES = {
  home: '/',
  product: '/#showcase',
  features: '/#showcase',
  platform: '/#showcase',
  solutions: '/#week',
  pricing: '/#pricing',
  security: '/legal/security',
  contact: '/#cta',
  about: '/#showcase',
  privacy: '/legal/privacy',
  terms: '/legal/terms',
  login: '/login',
  signup: '/signup',
} as const

export const HEADER_NAV = [
  { label: 'The desk', href: '/#desk' },
  { label: 'The week', href: '/#week' },
  { label: 'Sign-off', href: '/#signoff' },
  { label: 'Pricing', href: '/#pricing' },
] as const

export const FOOTER_PRODUCT = [
  { label: 'Resume Screening', href: '/#desk' },
  { label: 'AI Matching', href: '/#two' },
  { label: 'Job posts', href: '/#jobs' },
  { label: 'How it works', href: '/#showcase' },
] as const

export const FOOTER_COMPANY = [
  { label: 'About', href: '/#showcase' },
  { label: 'Contact', href: '/#cta' },
  { label: 'Pricing', href: '/#pricing' },
] as const

export const FOOTER_LEGAL = [
  { label: 'Privacy', href: MARKETING_ROUTES.privacy },
  { label: 'Terms', href: MARKETING_ROUTES.terms },
  { label: 'Security', href: MARKETING_ROUTES.security },
] as const
