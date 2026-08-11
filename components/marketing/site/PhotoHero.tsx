'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { HERO } from '@/content/marketing/homepage'
import { PHOTOS } from '@/content/marketing/photos'

function WordsPullUp({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  const words = text.split(' ')

  return (
    <span ref={ref} className={`inline-flex flex-wrap max-w-full ${className}`}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          initial={{ y: 16, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block max-w-full [overflow-wrap:normal] [word-break:keep-all]"
          style={{ marginRight: i === words.length - 1 ? 0 : '0.12em' }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  )
}

export default function PhotoHero() {
  return (
    <section className="relative h-dvh w-full pt-16 px-3 pb-3 overflow-x-clip">
      <div className="relative h-full w-full overflow-hidden rounded-[1.75rem] sm:rounded-[2rem] group">
        <Image
          src={PHOTOS.hero.src}
          alt={PHOTOS.hero.alt}
          fill
          priority
          sizes="100vw"
          unoptimized
          className="object-cover object-center scale-110 motion-safe:animate-kenburns motion-safe:group-hover:scale-[1.18] transition-transform duration-[4000ms] ease-out"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B1F14] via-[#0B1F14]/45 to-[#0B1F14]/25" />

        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 md:px-10 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-10">
          <div className="grid grid-cols-12 items-end gap-4 sm:gap-6 max-w-7xl mx-auto min-w-0">
            <div className="col-span-12 lg:col-span-8 min-w-0 [container-type:inline-size]">
              <p className="text-[11px] tracking-[0.14em] sm:tracking-[0.22em] uppercase text-[#F97316] font-semibold mb-2 sm:mb-3">{HERO.kicker}</p>
              <h1
                className="font-display font-bold leading-[1.08] sm:leading-[0.95] tracking-[-0.03em] text-[#FCFCFA] max-w-full whitespace-nowrap text-[2.35rem] sm:text-6xl lg:text-[7vw]"
                style={{ fontSize: 'clamp(2.2rem, 14cqi, 7.5rem)' }}
              >
                <WordsPullUp text={HERO.title} />
              </h1>
            </div>
            <div className="col-span-12 flex flex-col gap-4 sm:gap-5 pb-1 lg:col-span-4 lg:pb-6 min-w-0">
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="text-sm sm:text-base text-white/85 leading-relaxed max-w-md"
              >
                {HERO.lede}
              </motion.p>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <Link
                  href={HERO.ctaPrimary.href}
                  className="group inline-flex items-center gap-2 self-start rounded-full bg-[#F97316] py-1 pl-5 pr-1 text-sm font-bold text-[#0B1F14] min-h-[44px]"
                >
                  {HERO.ctaPrimary.label}
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0B1F14] transition-transform group-hover:scale-110">
                    <ArrowRight className="h-4 w-4 text-[#FCFCFA]" />
                  </span>
                </Link>
                <Link
                  href={HERO.ctaSecondary.href}
                  className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full border border-white/40 text-white text-sm font-semibold"
                >
                  {HERO.ctaSecondary.label}
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
