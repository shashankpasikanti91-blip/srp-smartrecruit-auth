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

    const systemPrompt = `You are an expert recruitment marketing copywriter. \
Generate platform-optimised job posts for all 7 platforms listed below.

PLATFORM RULES:
- linkedin: Professional, structured, use ✅ or 📌 bullet points, 200-300 words, end with 3-5 relevant hashtags
- whatsapp: Friendly & concise, bullet points, 80-120 words, 2-3 emojis, end with "Apply / DM us"
- email: Start with "Subject: <subject line>", blank line, then the email body. 200-300 words. Professional.
- twitter: Max 280 characters, punchy, 1-2 hashtags, include "Apply now" CTA
- indeed: ATS-friendly, structured (Overview / Responsibilities / Requirements / Benefits), no emojis, 250-350 words
- telegram: Concise with emojis, formatted with bold using *text*, 100-150 words
- facebook: Friendly and accessible, conversational tone, 150-200 words

Return ONLY valid JSON with exactly these 7 keys: linkedin, whatsapp, email, twitter, indeed, telegram, facebook. No markdown fences, no extra text outside the JSON object.`

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
