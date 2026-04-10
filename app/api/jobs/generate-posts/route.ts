import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { upsertJobPostContents } from '@/lib/db'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as Record<string, unknown>).userId as string

  try {
    const body = await req.json() as {
      job_post_id?: string
      title: string; company?: string; location?: string; type?: string
      description?: string; requirements?: string; custom_prompt?: string
    }
    if (!body.title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

    const apiKey = process.env.OPENAI_API_KEY
    const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    const jobContext = [
      `Job Title: ${body.title}`,
      body.company    && `Company: ${body.company}`,
      body.location   && `Location: ${body.location}`,
      body.type       && `Employment Type: ${body.type}`,
      body.description && `Description: ${body.description}`,
      body.requirements && `Requirements: ${body.requirements}`,
      body.custom_prompt && `Special Instructions: ${body.custom_prompt}`,
    ].filter(Boolean).join('\n')

    const systemPrompt = `You are an expert recruitment marketing copywriter. Generate richly structured, platform-optimised job posts for all 7 platforms.

═══════════════════════════════════════
LINKEDIN — follow this EXACT structure:
═══════════════════════════════════════
🚀 We're Hiring: [Job Title] | [Employment Type] | [Location]

[1-2 sentence engaging intro about the role and company]

📌 Role Details:
• Position: [title]
• Hire Type: [type]
• Experience: [years if available]
• Location: [location]

💻 Key Skills & Experience:
✅ [Skill 1]
✅ [Skill 2]
✅ [Skill 3]
(list all relevant skills from the JD)

🎯 Responsibilities:
▸ [Responsibility 1]
▸ [Responsibility 2]
▸ [Responsibility 3]
(list key responsibilities)

📧 Apply Now: Send your updated CV or DM us directly.

#[Hashtag1] #[Hashtag2] #[Hashtag3] #[Hashtag4] #[Hashtag5]

Total: 250-350 words. Professional tone.

═══════════════════════════════════════
WHATSAPP — follow this EXACT structure:
═══════════════════════════════════════
📢 Hiring: [Job Title] ([Employment Type])
📍 Location: [Location]
💼 Experience: [years if available]

Key Skills:
✅ [Skill 1]
✅ [Skill 2]
✅ [Skill 3]
✅ [Skill 4]
✅ [Skill 5]
(list 5-8 top skills)

[1 short friendly sentence about the opportunity]

Interested? DM us or send your CV now! 🙌

Total: 80-130 words. Friendly, scannable.

═══════════════════════════════════════
EMAIL — follow this EXACT structure:
═══════════════════════════════════════
Subject: [Compelling subject line]

Dear [Candidate/Hiring Manager],

[Opening paragraph: role overview and company context, 2-3 sentences]

Role Highlights:
• [Point 1]
• [Point 2]
• [Point 3]

Requirements:
• [Requirement 1]
• [Requirement 2]
• [Requirement 3]

[Closing: call to action, how to apply]

Best regards,
Talent Acquisition Team

Total: 200-280 words. Professional.

═══════════════════════════════════════
TWITTER/X — max 280 characters:
═══════════════════════════════════════
🚀 Hiring [Job Title] in [Location]! [1 punchy sentence about the role]. Key skills: [2-3 skills]. Apply now! 👇 #[Hashtag1] #[Hashtag2]

═══════════════════════════════════════
INDEED — ATS-friendly, NO emojis, this EXACT structure:
═══════════════════════════════════════
Job Title: [Title]
Location: [Location]
Employment Type: [Type]

OVERVIEW
[2-3 sentence description of the role and company]

KEY RESPONSIBILITIES
- [Responsibility 1]
- [Responsibility 2]
- [Responsibility 3]
- [Responsibility 4]
- [Responsibility 5]

REQUIREMENTS
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]
- [Requirement 4]

WHAT WE OFFER
- Competitive salary
- [Benefit 2]
- [Benefit 3]

To apply, please submit your resume and portfolio.

Total: 250-350 words. Clean, ATS-parseable.

═══════════════════════════════════════
TELEGRAM — follow this EXACT structure:
═══════════════════════════════════════
🔔 *[Job Title]* — [Employment Type]
📍 [Location] | 💼 [Experience] years

*What we need:*
✅ [Skill 1]
✅ [Skill 2]
✅ [Skill 3]
✅ [Skill 4]

*Your role:*
▸ [Responsibility 1]
▸ [Responsibility 2]
▸ [Responsibility 3]

📩 Interested? DM us with your CV!

Total: 100-150 words.

═══════════════════════════════════════
FACEBOOK — follow this EXACT structure:
═══════════════════════════════════════
🎉 Exciting Opportunity: [Job Title] at [Company]!

[1-2 friendly sentences about the role and team culture]

What you'll be doing:
✔️ [Responsibility 1]
✔️ [Responsibility 2]
✔️ [Responsibility 3]

What we're looking for:
🔹 [Requirement 1]
🔹 [Requirement 2]
🔹 [Requirement 3]

[Location] | [Employment Type][Experience details if available]

Ready to join us? Drop your CV in the comments or send us a DM! 💬

#[Hashtag1] #[Hashtag2] #[Hashtag3]

Total: 150-200 words. Warm, conversational.

═══════════════════════════════════════
Return ONLY valid JSON with exactly these 7 keys: linkedin, whatsapp, email, twitter, indeed, telegram, facebook.
No markdown fences. No extra text outside the JSON object. Use \\n for line breaks inside the JSON string values.`

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://recruit.srpailabs.com',
        'X-Title': 'SRP SmartRecruit',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate job posts for:\n${jobContext}` },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`AI API error ${res.status}: ${errText}`)
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content ?? '{}'
    const posts = JSON.parse(raw) as Record<string, string>

    // Persist to DB if we have a job_post_id (scoped to the authenticated user)
    if (body.job_post_id) {
      await upsertJobPostContents({ job_post_id: body.job_post_id, user_id: userId, posts })
    }

    return NextResponse.json({ posts })
  } catch (err) {
    console.error('[api/jobs/generate-posts]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
