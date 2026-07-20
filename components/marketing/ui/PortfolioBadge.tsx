import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import CinematicSection from '@/components/marketing/ui/CinematicSection'

export default function PortfolioBadge() {
  return (
    <CinematicSection variant="band" className="py-12 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5 rounded-2xl border border-violet-500/15 bg-violet-500/[0.04]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-300 shrink-0">
              <Sparkles className="w-5 h-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Built by SRP AI Labs for modern AI-first hiring teams</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">Part of the SRP AI Labs product ecosystem — the same design standard we apply to premium AI product websites.</p>
            </div>
          </div>
          <Link href="/company/about" className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 whitespace-nowrap">About SRP AI Labs →</Link>
        </div>
      </div>
    </CinematicSection>
  )
}
