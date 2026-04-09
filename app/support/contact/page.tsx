'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Mail, MessageSquare, Calendar, ArrowRight, CheckCircle } from 'lucide-react'

const contactOptions = [
  {
    icon: <Calendar className="w-6 h-6" />,
    title: 'Book a demo',
    desc: 'See SRP in action with a live 30-minute personalised walkthrough from our team.',
    cta: 'Schedule demo',
    accent: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
  },
  {
    icon: <MessageSquare className="w-6 h-6" />,
    title: 'Talk to sales',
    desc: 'Questions about pricing, enterprise plans, or integrations? Our sales team is here.',
    cta: 'Start conversation',
    accent: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  {
    icon: <Mail className="w-6 h-6" />,
    title: 'Email us',
    desc: 'Prefer email? Reach us at sales@srpailabs.com — we reply within 1 business day.',
    cta: 'Send email',
    accent: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
  },
]

const subjects = [
  'I\'d like a platform demo',
  'Enterprise / team pricing',
  'Integration question',
  'Partnership opportunity',
  'Media / press enquiry',
  'Other',
]

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', company: '', subject: '', message: '' })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Simulate submission
    await new Promise(r => setTimeout(r, 1200))
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#07070e] pt-16">

        {/* Hero */}
        <section className="py-20 border-b border-white/5">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 mb-5">
              Get in touch
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Let's talk</h1>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Whether you're ready to buy, just exploring, or have a specific question — we'd love to hear from you.
            </p>
          </div>
        </section>

        {/* Contact options */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {contactOptions.map((opt) => (
            <div key={opt.title} className={`bg-white/3 border ${opt.border} rounded-xl p-6 text-center`}>
              <div className={`w-12 h-12 rounded-xl ${opt.bg} flex items-center justify-center ${opt.accent} mx-auto mb-4`}>
                {opt.icon}
              </div>
              <h3 className="text-white font-semibold mb-2">{opt.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">{opt.desc}</p>
              <span className={`text-sm font-medium ${opt.accent} flex items-center gap-1 justify-center`}>
                {opt.cta} <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          ))}
        </section>

        {/* Form */}
        <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="bg-white/3 border border-white/10 rounded-2xl p-8">
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-7 h-7 text-green-400" />
                </div>
                <h2 className="text-white font-bold text-xl mb-2">Message sent!</h2>
                <p className="text-gray-500 text-sm mb-6">We'll get back to you within 1 business day.</p>
                <button onClick={() => setSubmitted(false)}
                  className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-white font-bold text-xl mb-6">Send us a message</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5" htmlFor="name">Full name *</label>
                      <input id="name" name="name" type="text" required value={form.name} onChange={handleChange}
                        placeholder="Alex Johnson"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5" htmlFor="email">Work email *</label>
                      <input id="email" name="email" type="email" required value={form.email} onChange={handleChange}
                        placeholder="alex@company.com"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5" htmlFor="company">Company name</label>
                    <input id="company" name="company" type="text" value={form.company} onChange={handleChange}
                      placeholder="Acme Corp"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5" htmlFor="subject">Subject *</label>
                    <select id="subject" name="subject" required value={form.subject} onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all appearance-none">
                      <option value="" disabled className="bg-[#111]">Select a subject...</option>
                      {subjects.map(s => <option key={s} value={s} className="bg-[#111]">{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5" htmlFor="message">Message *</label>
                    <textarea id="message" name="message" required rows={5} value={form.message} onChange={handleChange}
                      placeholder="Tell us what you're looking for..."
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all resize-none" />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center justify-center gap-2">
                    {loading ? (
                      <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
                    ) : (
                      <> Send message <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
