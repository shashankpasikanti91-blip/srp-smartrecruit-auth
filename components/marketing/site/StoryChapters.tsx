import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { SCREEN_STORY, MATCH_STORY, REVIEW_STORY, SEND_STORY, JOBS_STORY } from '@/content/marketing/siteStory'

/** Accenture-style module: 50/50, photo flush (no frame), text beside it. */
function Module({
  id,
  dark,
  imageLeft,
  photo,
  kicker,
  title,
  lede,
  points,
  cta,
}: {
  id: string
  dark?: boolean
  imageLeft: boolean
  photo: { src: string; alt: string }
  kicker: string
  title: string
  lede: string
  points: readonly { title: string; text: string }[]
  cta?: { label: string; href: string }
}) {
  return (
    <section id={id} className={dark ? 'bg-[#0B1F14] text-[#FCFCFA]' : 'bg-[#FCFCFA] text-[#111827]'}>
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center px-5 sm:px-8 py-14 lg:py-20">
        <div className={`relative aspect-[4/5] sm:aspect-[5/4] lg:aspect-[4/5] w-full overflow-hidden ${imageLeft ? 'lg:order-1' : 'lg:order-2'}`}>
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            sizes="(min-width:1024px) 50vw, 100vw"
            className="object-cover motion-safe:transition-transform motion-safe:duration-[1200ms] motion-safe:hover:scale-[1.03]"
            unoptimized
          />
        </div>
        <div className={`max-w-xl ${imageLeft ? 'lg:order-2' : 'lg:order-1'}`}>
          <p className={`text-[11px] tracking-[0.2em] uppercase font-semibold ${dark ? 'text-[#F97316]' : 'text-[#166534]'}`}>
            {kicker}
          </p>
          <h2 className="mt-4 font-display text-3xl sm:text-[2.35rem] leading-[1.15]">{title}</h2>
          <p className={`mt-5 text-base leading-[1.75] ${dark ? 'text-white/75' : 'text-[#4B5563]'}`}>{lede}</p>
          <ul className="mt-8 space-y-5">
            {points.map((p) => (
              <li key={p.title}>
                <p className="font-semibold">{p.title}</p>
                <p className={`mt-1 text-sm leading-relaxed ${dark ? 'text-white/65' : 'text-[#4B5563]'}`}>{p.text}</p>
              </li>
            ))}
          </ul>
          {cta && (
            <Link
              href={cta.href}
              className={`mt-8 inline-flex items-center gap-2 text-sm font-bold min-h-[44px] ${dark ? 'text-white' : 'text-[#0B1F14]'}`}
            >
              {cta.label}
              <span className="flex h-8 w-8 items-center justify-center bg-[#F97316] text-[#0B1F14]">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

export default function StoryChapters() {
  return (
    <div>
      <Module
        id={SCREEN_STORY.id}
        imageLeft
        photo={SCREEN_STORY.photo}
        kicker={SCREEN_STORY.kicker}
        title={SCREEN_STORY.title}
        lede={SCREEN_STORY.lede}
        points={SCREEN_STORY.beats.map(({ title, text }) => ({ title, text }))}
      />
      <Module
        id={MATCH_STORY.id}
        dark
        imageLeft={false}
        photo={MATCH_STORY.photo}
        kicker={MATCH_STORY.kicker}
        title={MATCH_STORY.title}
        lede={MATCH_STORY.lede}
        points={MATCH_STORY.whyThis}
      />
      <section id={REVIEW_STORY.id} className="relative min-h-[72svh] flex items-end overflow-hidden">
        <Image
          src={REVIEW_STORY.photo.src}
          alt={REVIEW_STORY.photo.alt}
          fill
          sizes="100vw"
          className="object-cover"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F14] via-[#0B1F14]/50 to-transparent" />
        <div className="relative z-10 max-w-3xl mx-auto px-5 sm:px-8 pb-14 pt-32 w-full">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#F97316] font-semibold">{REVIEW_STORY.kicker}</p>
          <h2 className="mt-3 font-display text-3xl sm:text-5xl text-white leading-tight">{REVIEW_STORY.title}</h2>
          <p className="mt-5 text-base sm:text-lg text-white/85 leading-relaxed">{REVIEW_STORY.lede}</p>
          <ul className="mt-6 space-y-2">
            {REVIEW_STORY.bullets.map((line) => (
              <li key={line} className="text-white/90 text-[15px] leading-relaxed">{line}</li>
            ))}
          </ul>
        </div>
      </section>
      <Module
        id={SEND_STORY.id}
        imageLeft
        photo={SEND_STORY.photo}
        kicker={SEND_STORY.kicker}
        title={SEND_STORY.title}
        lede={SEND_STORY.lede}
        points={SEND_STORY.checks}
        cta={{ label: 'Open workspace', href: '/login' }}
      />
      <Module
        id={JOBS_STORY.id}
        dark
        imageLeft={false}
        photo={JOBS_STORY.photo}
        kicker={JOBS_STORY.kicker}
        title={JOBS_STORY.title}
        lede={JOBS_STORY.lede}
        points={JOBS_STORY.beats.map(({ title, text }) => ({ title, text }))}
      />
    </div>
  )
}
