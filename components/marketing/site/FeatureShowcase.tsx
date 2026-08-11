'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { SHOWCASE } from '@/content/marketing/siteStory'
import { PHOTOS } from '@/content/marketing/photos'

const TABS = [
  { value: 'screen', label: 'Screen', src: PHOTOS.inbox.src, alt: PHOTOS.inbox.alt },
  { value: 'match', label: 'Match', src: PHOTOS.compare.src, alt: PHOTOS.compare.alt },
  { value: 'review', label: 'Review', src: PHOTOS.reason.src, alt: PHOTOS.reason.alt },
  { value: 'send', label: 'Send', src: PHOTOS.handoff.src, alt: PHOTOS.handoff.alt },
  { value: 'jobs', label: 'Jobs', src: PHOTOS.hero.src, alt: PHOTOS.hero.alt },
]

export default function FeatureShowcase() {
  return (
    <section id="showcase" className="w-full bg-[#FCFCFA] text-[#111827] border-t border-[#E5E7EB]">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 sm:px-8 py-16 md:grid-cols-12 md:py-20 lg:gap-14">
        <div className="md:col-span-6">
          <Badge variant="outline" className="mb-6">{SHOWCASE.eyebrow}</Badge>
          <h2 className="font-display text-balance text-4xl leading-[0.95] sm:text-5xl">{SHOWCASE.title}</h2>
          <p className="mt-6 max-w-xl text-[#4B5563]">{SHOWCASE.description}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {SHOWCASE.stats.map((s) => (
              <Badge key={s} variant="secondary">{s}</Badge>
            ))}
          </div>
          <div className="mt-10 max-w-xl">
            <Accordion type="single" collapsible defaultValue="step-1" className="w-full">
              {SHOWCASE.steps.map((step) => (
                <AccordionItem key={step.id} value={step.id}>
                  <AccordionTrigger>{step.title}</AccordionTrigger>
                  <AccordionContent>{step.text}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/login">Open workspace</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/#pricing">See plans</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="md:col-span-6">
          <div className="relative overflow-hidden h-[52vh] max-h-[420px] sm:h-[480px] sm:max-h-none md:h-[520px] min-h-[220px]">
            <Tabs defaultValue="screen" className="relative h-full w-full">
              <div className="relative h-full w-full overflow-hidden">
                {TABS.map((t, idx) => (
                  <TabsContent
                    key={t.value}
                    value={t.value}
                    forceMount
                    className="absolute inset-0 m-0 h-full w-full data-[state=inactive]:hidden data-[state=inactive]:pointer-events-none"
                  >
                    <Image
                      src={t.src}
                      alt={t.alt}
                      fill
                      sizes="(min-width:768px) 50vw, 100vw"
                      className="object-cover motion-safe:hover:scale-105 motion-safe:transition-transform motion-safe:duration-700"
                      unoptimized
                      priority={idx === 0}
                    />
                  </TabsContent>
                ))}
              </div>
              <div className="pointer-events-auto absolute inset-x-0 bottom-4 z-10 flex w-full justify-center">
                <TabsList className="flex gap-1 bg-[#0B1F14]/80 p-1 backdrop-blur">
                  {TABS.map((t) => (
                    <TabsTrigger key={t.value} value={t.value} className="rounded-lg px-3 py-2">
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </section>
  )
}
