import type { Metadata } from 'next'
import './globals.css'
import './marketing.css'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'SRP SmartRecruit — AI-powered Recruitment Operating System',
  description:
    'SRP SmartRecruit helps recruitment agencies screen resumes, match candidates to job requirements, explain fit, and manage hiring pipelines with human oversight.',
  keywords: ['AI recruiting', 'ATS', 'hiring automation', 'candidate screening', 'SRP SmartRecruit'],
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/favicon.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.svg', type: 'image/svg+xml' }],
  },
  openGraph: {
    title: 'SRP SmartRecruit — AI-powered Recruitment OS',
    description: 'Hire smarter with AI.',
    type: 'website',
    url: 'https://recruit.srpailabs.com',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
