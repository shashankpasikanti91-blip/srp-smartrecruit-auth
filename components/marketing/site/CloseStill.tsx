import Link from 'next/link'
import Image from 'next/image'
import { CLOSE } from '@/content/marketing/siteStory'

export default function CloseStill() {
  return (
    <section id="cta" className="group relative min-h-[80svh] flex items-end overflow-hidden">
      <Image src={CLOSE.photo.src} alt={CLOSE.photo.alt} fill sizes="100vw" className="object-cover object-center motion-safe:transition-transform motion-safe:duration-[1200ms] motion-safe:group-hover:scale-105" unoptimized />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F14] via-[#0B1F14]/60 to-transparent" />
      <div className="relative z-10 max-w-3xl mx-auto px-5 sm:px-8 pb-16 pt-40">
        <p className="text-[11px] tracking-[0.2em] uppercase text-[#F97316] font-semibold">{CLOSE.kicker}</p>
        <h2 className="mt-3 font-display text-3xl sm:text-5xl text-white leading-tight">{CLOSE.title}</h2>
        <p className="mt-5 text-base sm:text-lg text-white/85 leading-relaxed max-w-xl">{CLOSE.body}</p>
        <Link
          href={CLOSE.cta.href}
          className="mt-8 inline-flex items-center justify-center min-h-[44px] px-8 py-3 rounded-full bg-[#F97316] text-[#0B1F14] text-sm font-bold"
        >
          {CLOSE.cta.label}
        </Link>
      </div>
    </section>
  )
}
