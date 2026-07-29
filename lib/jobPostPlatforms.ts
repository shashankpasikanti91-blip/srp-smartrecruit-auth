/** Shared platform definitions + copy prompts for multi-channel JD posts.
 * Version: 2026-07-30 — Primary channels: LinkedIn, WhatsApp, Email, Indeed.
 * Spec: docs/master/03-ai/GeneratePost.md + Prompt-Standards.md
 * LinkedIn quality locked; WhatsApp + Email must be share-ready (not 2–3 line teasers).
 */

/** Channels shown in Generate Post UI (default selection). */
export const JOB_POST_PLATFORMS = [
  'linkedin',
  'whatsapp',
  'email',
  'indeed',
] as const

export type JobPostPlatform = (typeof JOB_POST_PLATFORMS)[number]

/** Legacy keys still readable from older saved job_post_contents / JSON. */
export const JOB_POST_LEGACY_PLATFORMS = [
  'jobstreet',
  'naukri',
  'career_page',
  'referral',
  'twitter',
  'telegram',
  'facebook',
  'long',
  'medium',
  'short',
] as const

export type JobPostPlatformAny = JobPostPlatform | (typeof JOB_POST_LEGACY_PLATFORMS)[number]

export const JOB_POST_PLATFORM_META: Record<
  JobPostPlatformAny,
  { label: string; hint: string }
> = {
  linkedin: { label: 'LinkedIn', hint: 'Professional structured post with bullets & hashtags' },
  whatsapp: { label: 'WhatsApp', hint: 'Share-ready hiring note (full role + skills + CTA)' },
  email: { label: 'Email', hint: 'Subject + full outreach body' },
  indeed: { label: 'Indeed', hint: 'About role, responsibilities, requirements' },
  jobstreet: { label: 'JobStreet', hint: 'Legacy' },
  naukri: { label: 'Naukri', hint: 'Legacy' },
  career_page: { label: 'Company Career Page', hint: 'Legacy' },
  referral: { label: 'Referral Version', hint: 'Legacy' },
  twitter: { label: 'Twitter/X', hint: 'Legacy' },
  telegram: { label: 'Telegram', hint: 'Legacy' },
  facebook: { label: 'Facebook', hint: 'Legacy' },
  long: { label: 'Long Version', hint: 'Legacy' },
  medium: { label: 'Medium Version', hint: 'Legacy' },
  short: { label: 'Short Version', hint: 'Legacy' },
}

const ALL_KNOWN = new Set<string>([
  ...JOB_POST_PLATFORMS,
  ...JOB_POST_LEGACY_PLATFORMS,
])

const PLATFORM_PROMPTS: Record<JobPostPlatform, string> = {
  linkedin: `LINKEDIN — professional recruiter post (200–350 words):
Include: hook, about the role, key responsibilities (bullets), must-have requirements, nice-to-haves if known, location/type, CTA, 4–6 hashtags.
Preserve skills, experience, location, and benefits from the JD. Do not invent fake perks.
Keep the same high quality as existing LinkedIn output — do not shorten.`,

  whatsapp: `WHATSAPP — share-ready hiring message (150–250 words, NOT a 2–3 line teaser):
Structure with clear line breaks:
1) Hook line: Hiring: [Role] · [Employment type] · [Location]
2) About the role: 2–4 sentences from the JD (what they will do / why the role matters)
3) Key skills: pipe or bullet list of must-have skills from JD
4) Must-haves: experience years, tools, domain notes from JD
5) Soft CTA: ask candidates to DM CV / reply with experience summary
Use a professional recruiter tone suitable for forwarding to a WhatsApp group or candidate chat.
Preserve important JD facts. Never collapse to a one-liner when the JD is rich.`,

  email: `EMAIL — full outreach email (not a stub):
Line 1 MUST be: Subject: <compelling subject with role + location if known>
Then a blank line, then the body (180–280 words) with:
- Greeting
- Opening: who we are hiring for and why (from JD)
- Role snapshot: location, employment type, key responsibilities (bullets)
- Must-have requirements (bullets)
- Clear apply CTA (reply with CV / apply link placeholder)
Professional staffing-agency tone. Preserve JD skills and experience. Do not invent benefits.`,

  indeed: `INDEED — ATS-friendly plain text (rich, structured):
About the Role, What you'll do (bullets), What you'll bring (bullets), Preferred, Location & type, Apply CTA.
Keep important JD facts. Match LinkedIn-level completeness without hashtags.`,
}

export function normalizePlatforms(input?: string[] | null): JobPostPlatform[] {
  const selected = (input ?? [])
    .map(p => p.toLowerCase().trim())
    .filter((p): p is JobPostPlatform =>
      (JOB_POST_PLATFORMS as readonly string[]).includes(p),
    )
  return selected.length > 0 ? selected : [...JOB_POST_PLATFORMS]
}

/** Accept legacy keys when reading cached posts for display. */
export function isKnownPlatform(p: string): p is JobPostPlatformAny {
  return ALL_KNOWN.has(p)
}

export function buildJobPostSystemPrompt(platforms: JobPostPlatform[]): string {
  const sections = platforms.map(p => PLATFORM_PROMPTS[p]).join('\n\n')
  const keys = platforms.join(', ')
  return `You are a senior staffing-agency recruitment copywriter for SRP Smart Recruit.
Write professional recruiter-quality channel posts from the ORIGINAL job description.

RULES:
1. Never drop important JD information (skills, years, location, employment type, visa notes, salary if present).
2. Do NOT write empty one-line posts when the JD is rich — especially LinkedIn, Indeed, WhatsApp, and Email.
3. WhatsApp and Email must be share-ready (multi-paragraph / structured), never 2–3 thin lines.
4. LinkedIn quality must stay high (200–350 words with bullets + hashtags).
5. Each platform has a DIFFERENT style — follow each section.
6. Do not invent fake company culture or benefits missing from the JD.
7. Use \\n for line breaks inside JSON string values.

${sections}

Return ONLY valid JSON with exactly these keys: ${keys}.
No markdown fences. No extra text outside the JSON object.`
}
