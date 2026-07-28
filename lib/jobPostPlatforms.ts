/** Shared platform definitions + copy prompts for multi-channel JD posts.
 * Recruiter style: short, professional, practical — not long marketing copy.
 */

export const JOB_POST_PLATFORMS = [
  'linkedin',
  'whatsapp',
  'email',
  'twitter',
  'indeed',
  'telegram',
  'facebook',
] as const

export type JobPostPlatform = (typeof JOB_POST_PLATFORMS)[number]

export const JOB_POST_PLATFORM_META: Record<
  JobPostPlatform,
  { label: string; hint: string }
> = {
  linkedin: {
    label: 'LinkedIn',
    hint: 'Professional post — role, skills, location, hashtags',
  },
  whatsapp: {
    label: 'WhatsApp',
    hint: 'Short group hiring note — role, skills, location, CTA',
  },
  email: {
    label: 'Email',
    hint: 'Subject + brief role + requirements + apply CTA',
  },
  twitter: {
    label: 'Twitter/X',
    hint: 'Punchy ≤280 chars with hashtags',
  },
  indeed: {
    label: 'Indeed',
    hint: 'Clean ATS text — about, responsibilities, requirements',
  },
  telegram: {
    label: 'Telegram',
    hint: 'Compact channel hiring note',
  },
  facebook: {
    label: 'Facebook',
    hint: 'Warm short post with role + skills',
  },
}

const PLATFORM_PROMPTS: Record<JobPostPlatform, string> = {
  linkedin: `LINKEDIN — professional recruiter style (keep under 180 words):
We're hiring: [Job Title] | [Permanent/Contract] | [Location]

About the role:
[2 short sentences]

Key skills: [Skill1], [Skill2], [Skill3], [Skill4]

Requirements:
• [1–2 must-haves]

Interested? Share your CV or message us.

#[Hashtag1] #[Hashtag2] #[Hashtag3] #[Hashtag4]

No fluff. No long company culture paragraphs.`,

  whatsapp: `WHATSAPP — short professional group message (60–100 words):
Hiring: [Job Title]
Type: [Permanent / Contract]
Location: [Location]
Experience: [years if known]

Key skills: [Skill1] | [Skill2] | [Skill3] | [Skill4]

Requirements: [1 short line]

DM CV if interested.

Plain text. Minimal emoji (max 1–2). Easy to forward in recruiter groups.`,

  email: `EMAIL — professional and brief (120–180 words):
Subject: Opening — [Job Title] ([Location])

Hi,

We are hiring a [Job Title] ([Permanent/Contract]) based in [Location].

About the role:
[2–3 sentences]

Key skills: [list]
Requirements: [3–5 short bullets]
Budget: [only if known]

Please reply with your updated CV if interested.

Best regards,
Talent Acquisition

No marketing fluff.`,

  twitter: `TWITTER/X — max 280 characters:
Hiring [Job Title] | [Location] | [Permanent/Contract]. Skills: [2–3]. DM CV. #[Hashtag1] #[Hashtag2]`,

  indeed: `INDEED — ATS-friendly, NO emojis, short sections:
Job Title: [Title]
Location: [Location]
Employment Type: [Permanent/Contract/Full-time]

ABOUT THE ROLE
[2–3 sentences]

KEY RESPONSIBILITIES
- [4–6 bullets]

REQUIREMENTS
- [4–6 bullets]

KEY SKILLS
- [skills]

BUDGET
[only if provided]

To apply, submit your resume.`,

  telegram: `TELEGRAM — compact professional note (80–120 words):
*[Job Title]* — [Permanent/Contract]
Location: [Location]

About: [1–2 sentences]
Skills: [Skill1], [Skill2], [Skill3]
Requirements: [1 short line]

DM CV to apply.`,

  facebook: `FACEBOOK — warm but professional (100–140 words):
We're hiring: [Job Title] ([Permanent/Contract]) — [Location]

About the role: [2 sentences]

Key skills: [Skill1], [Skill2], [Skill3]
Requirements: [2–3 short points]

Comment or message us with your CV.

#[Hashtag1] #[Hashtag2] #[Hashtag3]`,
}

export function normalizePlatforms(input?: unknown): JobPostPlatform[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [...JOB_POST_PLATFORMS]
  }
  const selected = input
    .map(v => String(v).toLowerCase().trim())
    .filter((v): v is JobPostPlatform =>
      (JOB_POST_PLATFORMS as readonly string[]).includes(v)
    )
  return selected.length > 0 ? selected : [...JOB_POST_PLATFORMS]
}

export function buildJobPostSystemPrompt(platforms: JobPostPlatform[]): string {
  const sections = platforms.map(p => PLATFORM_PROMPTS[p]).join('\n\n')
  const keys = platforms.join(', ')
  return `You are a staffing-agency recruitment copywriter.
Write SHORT, professional channel posts for recruiters — not long marketing essays.

Focus only on: About the Role, Responsibilities (brief), Requirements, Key Skills, Budget (if known), Location, Permanent vs Contract.

Each platform has a DIFFERENT style — follow each section. Do not copy the same text across platforms.

${sections}

Return ONLY valid JSON with exactly these keys: ${keys}.
No markdown fences. No extra text outside the JSON object. Use \\n for line breaks inside the JSON string values.`
}
