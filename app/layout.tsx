import type { Metadata } from 'next'
import './globals.css'
import './marketing.css'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'SRP Recruit AI — Enterprise AI Recruitment Platform',
  description:
    'SRP Recruit AI helps recruitment agencies screen resumes, match candidates to job requirements, explain fit, and manage hiring pipelines with human oversight.',
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
