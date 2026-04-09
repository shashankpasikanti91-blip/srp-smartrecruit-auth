import type { Metadata } from 'next'
import './globals.css'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'SRP Recruit AI Labs — Smart Recruiting Platform',
  description:
    'Hire smarter with AI. SRP Recruit AI Labs automates candidate screening, job matching, and hiring workflows at scale.',
  keywords: ['AI recruiting', 'ATS', 'hiring automation', 'candidate screening', 'SRP Recruit AI Labs'],
  openGraph: {
    title: 'SRP Recruit AI Labs — Smart Recruiting Platform',
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
