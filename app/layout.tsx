import type { Metadata, Viewport } from 'next'
import './globals.css'
import './marketing.css'
import Providers from './providers'

const SITE = 'https://recruit.srpailabs.com'
const TITLE = 'SRP SmartRecruit'
const DESC =
  'SRP SmartRecruit screens CVs against your job brief, keeps the reason on the record, and lets recruiters send only the names they will stand behind.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: TITLE,
    template: '%s | SRP SmartRecruit',
  },
  description: DESC,
  keywords: [
    'SRP SmartRecruit',
    'SRP AI Labs',
    'recruitment software',
    'agency ATS',
    'CV screening',
    'candidate pipeline',
  ],
  authors: [{ name: 'SRP AI Labs', url: 'https://srpailabs.com' }],
  creator: 'SRP AI Labs',
  robots: { index: true, follow: true },
  alternates: { canonical: SITE },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SmartRecruit',
  },
  icons: {
    icon: [
      { url: '/icon.svg?v=4', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: TITLE,
    description: DESC,
    type: 'website',
    locale: 'en',
    url: SITE,
    siteName: 'SRP SmartRecruit',
    images: [{ url: '/og-cover.png', width: 1920, height: 1080, alt: 'SRP SmartRecruit — recruiter screening CVs against a job brief' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESC,
    images: ['/og-cover.png'],
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SRP SmartRecruit',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: SITE,
  description: DESC,
  publisher: {
    '@type': 'Organization',
    name: 'SRP AI Labs',
    url: 'https://srpailabs.com',
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#166534',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
