'use client'

import { ArrowRight, Calendar, Check } from 'lucide-react'
import { CONTACT_PAGE } from '@/content/marketing/contact'
import EditorialPageHero from '@/components/marketing/ui/EditorialPageHero'
import CinematicSection from '@/components/marketing/ui/CinematicSection'
import Image from 'next/image'
import { useState } from 'react'
import { MARKETING_PHOTOS } from '@/content/marketing/photos'

export default function ContactPageContent() {
  const { hero, demoBenefits, subjects } = CONTACT_PAGE
  const [form, setForm] = useState({ name: '', email: '', company: '', subject: '', message: '' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const subject = encodeURIComponent(form.subject || 'Demo request')
    const body = encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\nCompany: ${form.company}\n\n${form.message}`)
    window.location.href = `mailto:support@srpailabs.com?subject=${subject}&body=${body}`
  }

  return (
    <>
      <EditorialPageHero
        eyebrow={hero.eyebrow}
        title={hero.title}
        subtitle={hero.subtitle}
        size="compact"
      />

      <CinematicSection variant="mid" className="pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-violet-300">
              <Calendar className="w-5 h-5" aria-hidden />
              <span className="font-semibold">Why book a demo</span>
            </div>
            <ul className="space-y-4">
              {demoBenefits.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden />{b}
                </li>
              ))}
            </ul>
            <Image src={MARKETING_PHOTOS.agencyCommandCenter.src} alt={MARKETING_PHOTOS.agencyCommandCenter.alt} width={800} height={450} className="rounded-2xl w-full h-auto object-cover shadow-cinematic-glow" />
          </div>
          <form onSubmit={handleSubmit} className="rounded-2xl border border-cyan-500/20 bg-white/[0.02] p-8 space-y-4">
            <h2 className="text-white font-bold text-lg mb-2">Request a demo</h2>
            <input required name="name" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm" />
            <input required type="email" name="email" placeholder="Work email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm" />
            <input name="company" placeholder="Agency name" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm" />
            <select required name="subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm">
              <option value="" disabled className="bg-marketing-navy">Select subject</option>
              {subjects.map((s) => <option key={s} value={s} className="bg-marketing-navy">{s}</option>)}
            </select>
            <textarea required name="message" rows={4} placeholder="Tell us about your agency workflow..." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm resize-none" />
            <button type="submit" className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-semibold flex items-center justify-center gap-2 btn-glow">
              Send message <ArrowRight className="w-4 h-4" aria-hidden />
            </button>
          </form>
        </div>
      </CinematicSection>
    </>
  )
}
