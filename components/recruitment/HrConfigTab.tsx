'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Save, Settings2, Bell, Trash2 } from 'lucide-react'
import { CHECKLIST_COUNTRIES, getDocumentChecklist } from '@/lib/recruitmentOs'

type Template = {
  id: string
  template_type: string
  name: string
  subject?: string | null
  body?: string | null
  country_code?: string | null
  is_active?: boolean
}

type ReminderRule = {
  id?: string
  rule_key: string
  label: string
  entity_type: string
  offset_minutes: number
  channel: string
  is_active?: boolean
}

const TEMPLATE_TYPES = [
  'email', 'whatsapp', 'offer', 'interview', 'checklist', 'document', 'country',
  'offer_letter', 'joining_checklist', 'employment_contract', 'visa_requirements',
] as const

type CountrySetting = {
  id?: string
  country_code: string
  default_currency?: string
  holidays?: string[]
  payroll_defaults?: Record<string, unknown>
  visa_rules?: Record<string, unknown>
  is_active?: boolean
}

export function HrConfigTab() {
  const [section, setSection] = useState<'templates' | 'reminders' | 'checklists' | 'countries'>('templates')
  const [templates, setTemplates] = useState<Template[]>([])
  const [rules, setRules] = useState<ReminderRule[]>([])
  const [countrySettings, setCountrySettings] = useState<CountrySetting[]>([])
  const [countryDraft, setCountryDraft] = useState<CountrySetting>({
    country_code: 'MY',
    default_currency: 'MYR',
    holidays: [],
    payroll_defaults: {},
    visa_rules: {},
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [draft, setDraft] = useState({
    template_type: 'email',
    name: '',
    subject: '',
    body: '',
    country_code: 'MY',
  })
  const [checklistCountry, setChecklistCountry] = useState('MY')
  const [checklistEmployment, setChecklistEmployment] = useState<'local' | 'foreign'>('local')
  const [checklistItems, setChecklistItems] = useState<{ key: string; label: string; required?: boolean }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (section === 'templates') {
        const res = await fetch('/api/hr-config?section=templates')
        const data = await res.json()
        setTemplates(data.templates ?? [])
      } else if (section === 'reminders') {
        const res = await fetch('/api/hr-config?section=reminders')
        const data = await res.json()
        setRules(data.rules ?? [])
      } else if (section === 'countries') {
        const res = await fetch('/api/hr-config?section=country_settings')
        const data = await res.json()
        setCountrySettings(data.countries ?? [])
        const first = data.countries?.[0]
        if (first) {
          setCountryDraft({
            country_code: first.country_code,
            default_currency: first.default_currency ?? 'MYR',
            holidays: Array.isArray(first.holidays) ? first.holidays : [],
            payroll_defaults: first.payroll_defaults ?? {},
            visa_rules: first.visa_rules ?? {},
          })
        }
      } else {
        const res = await fetch(
          `/api/hr-config?section=checklists&country=${checklistCountry}&employment=${checklistEmployment}`
        )
        const data = await res.json()
        const items = data.checklist?.items ?? []
        setChecklistItems(
          Array.isArray(items) && items.length
            ? items
            : getDocumentChecklist(checklistCountry, checklistEmployment),
        )
      }
    } finally {
      setLoading(false)
    }
  }, [section, checklistCountry, checklistEmployment])

  useEffect(() => { load() }, [load])

  const saveTemplate = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/hr-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert_template', ...draft }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg(data.error ?? 'Save failed'); return }
      setMsg('Template saved')
      setDraft({ template_type: 'email', name: '', subject: '', body: '', country_code: 'MY' })
      await load()
    } finally {
      setSaving(false)
    }
  }

  const saveChecklist = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/hr-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert_checklist',
          country_code: checklistCountry,
          employment_type: checklistEmployment,
          items: checklistItems,
        }),
      })
      if (!res.ok) { setMsg('Save failed'); return }
      setMsg('Checklist saved for tenant')
    } finally {
      setSaving(false)
    }
  }

  const toggleRule = async (rule: ReminderRule) => {
    await fetch('/api/hr-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upsert_reminder',
        rule_key: rule.rule_key,
        label: rule.label,
        entity_type: rule.entity_type,
        offset_minutes: rule.offset_minutes,
        channel: rule.channel,
        is_active: !(rule.is_active !== false),
      }),
    })
    await load()
  }

  const runSweep = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/hr-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sweep_reminders' }),
      })
      const data = await res.json()
      setMsg(`Sweep: ${data.created ?? 0} reminders · ${data.escalated ?? 0} escalations · ${data.agent_created ?? 0} agent suggestions`)
    } finally {
      setSaving(false)
    }
  }

  const saveCountrySettings = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/hr-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert_country_settings', ...countryDraft }),
      })
      if (!res.ok) { setMsg('Save failed'); return }
      setMsg('Country settings saved')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const seedCountryPacks = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/hr-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_country_packs' }),
      })
      const data = await res.json()
      setMsg(`Seeded ${data.seeded ?? 0} country pack templates`)
      if (section === 'templates') await load()
    } finally {
      setSaving(false)
    }
  }

  const selectCountry = (c: CountrySetting) => {
    setCountryDraft({
      country_code: c.country_code,
      default_currency: c.default_currency ?? 'MYR',
      holidays: Array.isArray(c.holidays) ? c.holidays : [],
      payroll_defaults: c.payroll_defaults ?? {},
      visa_rules: c.visa_rules ?? {},
    })
  }

  return (
    <div className="space-y-5">
      <div className="dash-section-head">
        <div className="flex items-start gap-4">
          <div className="dash-section-icon"><Settings2 className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="page-title text-xl">HRMS</h1>
            <p className="desc-text mt-1 font-medium">HR admin configuration — templates, reminders, and country settings</p>
            <p className="desc-text mt-1 font-medium">Country, document, offer, email, WhatsApp, interview & reminder templates — no hardcoding.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['templates', 'Templates'],
          ['reminders', 'Reminder Rules'],
          ['checklists', 'Document Checklists'],
          ['countries', 'Country Settings'],
        ] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setSection(k)}
            className={`px-4 py-2 rounded-lg text-sm font-extrabold border transition-all ${
              section === k
                ? 'bg-indigo-600 text-white border-indigo-700'
                : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
            }`}>
            {label}
          </button>
        ))}
        <button type="button" onClick={runSweep} disabled={saving}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-extrabold text-amber-900 bg-amber-50 border border-amber-200 hover:bg-amber-100">
          <Bell className="w-4 h-4" /> Run Reminder Sweep
        </button>
      </div>

      {msg && <p className="text-sm font-bold text-emerald-700">{msg}</p>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : section === 'templates' ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="ess-panel p-4 space-y-3">
            <p className="text-sm font-extrabold text-slate-900">New / update template</p>
            <select value={draft.template_type} onChange={e => setDraft(d => ({ ...d, template_type: e.target.value }))}
              className="form-input font-bold w-full">
              {TEMPLATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="form-input font-bold w-full" placeholder="Template name" value={draft.name}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
            <input className="form-input font-bold w-full" placeholder="Subject (email/offer)" value={draft.subject}
              onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))} />
            <input className="form-input font-bold w-full" placeholder="Country code" value={draft.country_code}
              onChange={e => setDraft(d => ({ ...d, country_code: e.target.value }))} />
            <textarea className="form-input font-medium w-full min-h-[120px]" placeholder="Body / content"
              value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} />
            <button type="button" onClick={saveTemplate} disabled={saving || !draft.name}
              className="btn-primary inline-flex items-center gap-1.5 font-extrabold">
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Template'}
            </button>
          </div>
          <div className="ess-panel">
            <div className="ess-panel__head"><p className="ess-panel__title">Saved templates</p></div>
            <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {templates.length === 0 ? (
                <li className="px-4 py-8 text-sm font-bold text-slate-500 text-center">No templates yet — create one.</li>
              ) : templates.map(t => (
                <li key={t.id} className="px-4 py-3">
                  <p className="text-sm font-extrabold text-slate-900">{t.name}</p>
                  <p className="text-xs font-bold text-slate-500 capitalize">{t.template_type}{t.country_code ? ` · ${t.country_code}` : ''}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : section === 'reminders' ? (
        <div className="ess-panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {['Rule', 'Entity', 'Offset (min)', 'Channel', 'Active'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-800 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map(r => (
                <tr key={r.rule_key} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-900">{r.label}</td>
                  <td className="px-4 py-3 font-medium text-slate-700 capitalize">{r.entity_type}</td>
                  <td className="px-4 py-3 font-bold text-slate-800">{r.offset_minutes}</td>
                  <td className="px-4 py-3 font-medium text-slate-600">{r.channel}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => toggleRule(r)}
                      className={`px-2.5 py-1 rounded-md text-xs font-extrabold border ${
                        r.is_active !== false
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}>
                      {r.is_active !== false ? 'ON' : 'OFF'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : section === 'countries' ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="ess-panel p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={seedCountryPacks} disabled={saving}
                className="btn-primary inline-flex items-center gap-1.5 font-extrabold text-sm">
                <Plus className="w-4 h-4" /> Seed Country Packs (MY/IN/SG/AU/CA/AE)
              </button>
            </div>
            <select
              className="form-input font-bold w-full"
              value={countryDraft.country_code}
              onChange={e => {
                const found = countrySettings.find(c => c.country_code === e.target.value)
                if (found) selectCountry(found)
                else setCountryDraft(d => ({ ...d, country_code: e.target.value }))
              }}
            >
              {['MY', 'IN', 'SG', 'AU', 'CA', 'AE'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input className="form-input font-bold w-full" placeholder="Default currency"
              value={countryDraft.default_currency ?? ''}
              onChange={e => setCountryDraft(d => ({ ...d, default_currency: e.target.value }))} />
            <textarea
              className="form-input font-medium w-full min-h-[80px]"
              placeholder="Holidays (JSON array of dates)"
              value={JSON.stringify(countryDraft.holidays ?? [], null, 2)}
              onChange={e => {
                try { setCountryDraft(d => ({ ...d, holidays: JSON.parse(e.target.value) })) } catch { /* ignore */ }
              }}
            />
            <textarea
              className="form-input font-medium w-full min-h-[80px]"
              placeholder="Payroll defaults (JSON)"
              value={JSON.stringify(countryDraft.payroll_defaults ?? {}, null, 2)}
              onChange={e => {
                try { setCountryDraft(d => ({ ...d, payroll_defaults: JSON.parse(e.target.value) })) } catch { /* ignore */ }
              }}
            />
            <textarea
              className="form-input font-medium w-full min-h-[80px]"
              placeholder="Visa rules (JSON)"
              value={JSON.stringify(countryDraft.visa_rules ?? {}, null, 2)}
              onChange={e => {
                try { setCountryDraft(d => ({ ...d, visa_rules: JSON.parse(e.target.value) })) } catch { /* ignore */ }
              }}
            />
            <button type="button" onClick={saveCountrySettings} disabled={saving}
              className="btn-primary inline-flex items-center gap-1.5 font-extrabold">
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Country Settings'}
            </button>
          </div>
          <div className="ess-panel">
            <div className="ess-panel__head"><p className="ess-panel__title">Configured countries</p></div>
            <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {countrySettings.length === 0 ? (
                <li className="px-4 py-8 text-sm font-bold text-slate-500 text-center">Loading defaults…</li>
              ) : countrySettings.map(c => (
                <li key={c.country_code} className="px-4 py-3 cursor-pointer hover:bg-slate-50"
                  onClick={() => selectCountry(c)}>
                  <p className="text-sm font-extrabold text-slate-900">{c.country_code}</p>
                  <p className="text-xs font-bold text-slate-500">
                    {c.default_currency} · {Array.isArray(c.holidays) ? c.holidays.length : 0} holidays
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="ess-panel p-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <select className="form-input font-bold" value={checklistCountry}
              onChange={e => setChecklistCountry(e.target.value)}>
              {CHECKLIST_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            <select className="form-input font-bold" value={checklistEmployment}
              onChange={e => setChecklistEmployment(e.target.value as 'local' | 'foreign')}>
              <option value="local">Local</option>
              <option value="foreign">Expat (foreign)</option>
            </select>
            <button type="button" onClick={saveChecklist} disabled={saving}
              className="btn-primary inline-flex items-center gap-1.5 font-extrabold">
              <Save className="w-4 h-4" /> Save mapping
            </button>
          </div>
          <p className="text-xs text-slate-500">Map which documents to collect for Local vs Expat. Offer &amp; Candidate 360 use this list.</p>
          <ul className="space-y-2" data-testid="checklist-mapper">
            {checklistItems.map((item, idx) => (
              <li key={`${item.key}-${idx}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <input
                  value={item.key}
                  onChange={e => setChecklistItems(list => list.map((it, i) => i === idx ? { ...it, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') } : it))}
                  className="w-32 text-xs font-mono font-bold rounded border border-slate-200 px-2 py-1"
                  placeholder="key"
                />
                <input
                  value={item.label}
                  onChange={e => setChecklistItems(list => list.map((it, i) => i === idx ? { ...it, label: e.target.value } : it))}
                  className="flex-1 min-w-[10rem] text-sm font-bold rounded border border-slate-200 px-2 py-1"
                  placeholder="Label"
                />
                <label className="text-[10px] font-extrabold uppercase text-slate-600 inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={item.required !== false}
                    onChange={e => setChecklistItems(list => list.map((it, i) => i === idx ? { ...it, required: e.target.checked } : it))}
                  />
                  Required
                </label>
                <button
                  type="button"
                  onClick={() => setChecklistItems(list => list.filter((_, i) => i !== idx))}
                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                  aria-label="Remove document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <select
              className="form-input !py-1.5 !text-sm font-bold"
              defaultValue=""
              onChange={e => {
                const key = e.target.value
                if (!key) return
                const pack = [
                  ...getDocumentChecklist('MY', 'local'),
                  ...getDocumentChecklist('MY', 'foreign'),
                  ...getDocumentChecklist('IN', 'local'),
                ]
                const found = pack.find(p => p.key === key)
                if (checklistItems.some(i => i.key === key)) return
                setChecklistItems(list => [...list, { key, label: found?.label || key.replace(/_/g, ' '), required: found?.required ?? true }])
                e.target.value = ''
              }}
            >
              <option value="">Add from known slots…</option>
              {Array.from(new Map([
                ...getDocumentChecklist('MY', 'local'),
                ...getDocumentChecklist('MY', 'foreign'),
                ...getDocumentChecklist('IN', 'local'),
              ].map(i => [i.key, i])).values())
                .filter(i => !checklistItems.some(x => x.key === i.key))
                .map(i => (
                  <option key={i.key} value={i.key}>{i.label}</option>
                ))}
            </select>
            <button
              type="button"
              onClick={() => setChecklistItems(list => [...list, { key: `doc_${list.length + 1}`, label: 'New document', required: false }])}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-extrabold border border-indigo-200 text-indigo-700 bg-indigo-50"
            >
              <Plus className="w-3.5 h-3.5" /> Add custom document
            </button>
            <button
              type="button"
              onClick={() => setChecklistItems(getDocumentChecklist(checklistCountry, checklistEmployment))}
              className="text-xs font-extrabold text-slate-600 hover:underline"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
