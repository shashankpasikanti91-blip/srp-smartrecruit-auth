/** Shared platform definitions + copy prompts for multi-channel JD posts.
 * Version: 2026-07-28 — Restore recruiter-quality Long/Medium/Short (P4).
 * Spec: docs/master/03-ai/GeneratePost.md + Prompt-Standards.md
 */

export const JOB_POST_PLATFORMS = [
  'linkedin',
  'jobstreet',
  'indeed',
  'naukri',
  'career_page',
  'referral',
  'email',
  'whatsapp',
  'twitter',
  'telegram',
  'facebook',
  'long',
  'medium',
  'short',
] as const

export type JobPostPlatform = (typeof JOB_POST_PLATFORMS)[number]

export const JOB_POST_PLATFORM_META: Record<
  JobPostPlatform,
  { label: string; hint: string }
> = {
  linkedin: { label: 'LinkedIn', hint: 'Professional structured post with bullets & hashtags' },
  jobstreet: { label: 'JobStreet', hint: 'Clear ATS-friendly posting' },
  indeed: { label: 'Indeed', hint: 'About role, responsibilities, requirements' },
  naukri: { label: 'Naukri', hint: 'India job-board style with key skills' },
  career_page: { label: 'Company Career Page', hint: 'Full employer branding post' },
  referral: { label: 'Referral Version', hint: 'Peer-to-peer shareable note' },
  email: { label: 'Email', hint: 'Subject + body for outreach' },
  whatsapp: { label: 'WhatsApp', hint: 'Compact group hiring note' },
  twitter: { label: 'Twitter/X', hint: 'Punchy ≤280 chars' },
  telegram: { label: 'Telegram', hint: 'Channel hiring note' },
  facebook: { label: 'Facebook', hint: 'Warm social post' },
  long: { label: 'Long Version', hint: '250–400 words, full sections' },
  medium: { label: 'Medium Version', hint: '120–200 words condensed' },
  short: { label: 'Short Version', hint: '60–100 word teaser' },
}

const PLATFORM_PROMPTS: Record<JobPostPlatform, string> = {
  linkedin: `LINKEDIN — professional recruiter post (200–350 words):
Include: hook, about the role, key responsibilities (bullets), must-have requirements, nice-to-haves if known, location/type, CTA, 4–6 hashtags.
Preserve skills, experience, location, and benefits from the JD. Do not invent fake perks.`,

  jobstreet: `JOBSTREET — clean job-board post:
Sections: Job Overview, Responsibilities, Requirements, Skills, Employment Type & Location, How to Apply.
Use the full JD — do not drop must-have skills or experience.`,

  indeed: `INDEED — ATS-friendly plain text:
About the Role, What you'll do, What you'll bring, Preferred, Location & type, Apply CTA.
Keep important JD facts.`,

  naukri: `NAUKRI — India board style:
Role summary, Key Skills (comma list), Experience, Location, Responsibilities (bullets), Requirements.
Preserve all critical JD skills.`,

  career_page: `COMPANY CAREER PAGE — long-form employer post (Long quality):
Intro, Role mission, Responsibilities, Requirements, What we offer (only if in JD), Location/type, Apply.
Never invent benefits not in the source JD.`,

  referral: `REFERRAL — peer tone (Medium length):
"We're hiring [role]…" — key skills, location, who should apply, ask to forward CV.
Warm but professional.`,

  email: `EMAIL — Subject line on first line "Subject: …" then blank line then body.
Include role, must-haves, location, clear apply CTA. Medium length.`,

  whatsapp: `WHATSAPP — 60–120 words:
Hiring: title, type, location, key skills (pipe-separated), 1 requirement line, DM CV CTA.`,

  twitter: `TWITTER/X — ≤280 characters, role + location + 2–3 skills + CTA + hashtags.`,

  telegram: `TELEGRAM — compact channel note with title, skills, location, CTA.`,

  facebook: `FACEBOOK — warm short post with role, skills, location, invite to comment/DM.`,

  long: `LONG VERSION — 250–400 words structured:
About the Role, Responsibilities (bullets), Requirements, Skills, Location & Employment Type, CTA.
Preserve ALL important JD information. Never collapse to one line.`,

  medium: `MEDIUM VERSION — 120–200 words:
Condensed but complete: role, top responsibilities, must-haves, location, CTA.`,

  short: `SHORT VERSION — 60–100 words teaser:
Role, 3–5 skills, location, CTA. Still informative — not a single empty hiring line.`,
}

export function normalizePlatforms(input?: string[] | null): JobPostPlatform[] {
  const selected = (input ?? [])
    .map(p => p.toLowerCase().trim())
    .filter((p): p is JobPostPlatform =>
      (JOB_POST_PLATFORMS as readonly string[]).includes(p),
    )
  return selected.length > 0
    ? selected
    : ['linkedin', 'indeed', 'naukri', 'whatsapp', 'email', 'long', 'medium', 'short']
}

export function buildJobPostSystemPrompt(platforms: JobPostPlatform[]): string {
  const sections = platforms.map(p => PLATFORM_PROMPTS[p]).join('\n\n')
  const keys = platforms.join(', ')
  return `You are a senior staffing-agency recruitment copywriter for SRP Smart Recruit.
Write professional recruiter-quality channel posts from the ORIGINAL job description.

RULES:
1. Never drop important JD information (skills, years, location, employment type, visa notes, salary if present).
2. Do NOT write empty one-line posts when the JD is rich — especially for Long / LinkedIn / Career / Indeed / Naukri.
3. Each platform/variant has a DIFFERENT style — follow each section.
4. Do not invent fake company culture or benefits missing from the JD.
5. Use \\n for line breaks inside JSON string values.

${sections}

Return ONLY valid JSON with exactly these keys: ${keys}.
No markdown fences. No extra text outside the JSON object.`
}
