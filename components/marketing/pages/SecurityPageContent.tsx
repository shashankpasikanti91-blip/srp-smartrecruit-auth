import { SECURITY_PAGE } from '@/content/marketing/security'
import EditorialPageHero from '@/components/marketing/ui/EditorialPageHero'
import CinematicSection from '@/components/marketing/ui/CinematicSection'
import CTABlock from '@/components/marketing/ui/CTABlock'

export default function SecurityPageContent() {
  const { hero, pillars, faqs, contact } = SECURITY_PAGE

  return (
    <>
      <EditorialPageHero
        eyebrow={hero.eyebrow}
        title={hero.title}
        subtitle={hero.subtitle}
        size="compact"
        eyebrowClassName="text-emerald-400"
      />

      <CinematicSection variant="mid" className="py-16">
        <div className="max-w-5xl mx-auto px-4 grid sm:grid-cols-2 gap-6">
          {pillars.map((p) => (
            <div key={p.title} className="border border-white/8 rounded-2xl p-6 bg-white/[0.02]">
              <h2 className="font-semibold text-white mb-4">{p.title}</h2>
              <ul className="space-y-2">
                {p.items.map((item) => (
                  <li key={item} className="text-sm text-slate-500 flex gap-2"><span className="text-emerald-500">·</span>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CinematicSection>

      <CinematicSection variant="bleed" className="py-16">
        <div className="max-w-3xl mx-auto px-4 space-y-4">
          {faqs.map((f) => (
            <div key={f.q} className="border-b border-white/5 pb-4">
              <h3 className="text-white font-medium text-sm">{f.q}</h3>
              <p className="text-slate-500 text-sm mt-2">{f.a}</p>
            </div>
          ))}
          <p className="text-center text-sm text-slate-500 pt-4">
            {contact.title}: <a href={`mailto:${contact.email}`} className="text-emerald-400">{contact.email}</a>
          </p>
        </div>
      </CinematicSection>

      <CTABlock
        title="Questions about data handling?"
        subtitle="Our team can walk through access controls and human review workflows."
        primary={{ label: 'Contact us', href: '/support/contact' }}
        secondary={{ label: 'Privacy policy', href: '/legal/privacy' }}
      />
    </>
  )
}
