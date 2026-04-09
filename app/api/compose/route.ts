import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const maxDuration = 30

const COMPOSE_SYSTEM_PROMPT = `You are a Recruitment Communication Assistant AI.

Your task is to ONLY perform the action explicitly requested by the user: Reply, Rewrite, Paraphrase, or Generate a message.

You must strictly follow these rules:

1. Platform awareness - Write the message only for the platform specified (Gmail, LinkedIn, WhatsApp, Telegram).
2. Tone and professionalism - Follow the exact tone requested (formal, semi-formal, professional, friendly, casual). Always polite and respectful.
3. Content restrictions - Use ONLY the information provided. Do NOT add new details. Do NOT assume missing information.
4. Clarity and relevance - Stick strictly to the point. Avoid unnecessary explanations.
5. Writing quality - Output must sound natural, human-written, and professional.
6. Formatting rules - Use clean, simple formatting. No emojis unless tone is casual or friendly.

Do not break these rules under any circumstances.`

const EMAIL_TYPE_PROMPTS: Record<string, string> = {
  rejection: `Generate a professional, empathetic rejection email for a candidate who was not selected.
Be respectful, thank them for their time, and encourage future applications. Keep it brief and kind.`,

  followup: `Generate a follow-up email to check the status of a candidate's application or interview.
Be professional, concise, and express continued interest.`,

  interview_invite: `Generate a professional interview invitation email.
Include: role name, interview format (phone/video/onsite), date/time if provided, what to prepare.
Be warm, clear, and professional.`,

  shortlist: `Generate a shortlisting notification email to inform a candidate they've been shortlisted.
Express enthusiasm about their profile, mention next steps clearly.`,

  offer: `Generate a formal job offer email or offer letter covering: role, package (if provided), start date, acceptance deadline.
Be professional, concise, and welcoming.`,

  technical_test: `Generate an email inviting a candidate to complete a technical assessment or test.
Include: test name/platform (if provided), deadline, any instructions. Be clear and professional.`,

  thank_you: `Generate a post-interview thank you or acknowledgment email from the recruiter to the candidate.
Be warm, professional, and mention next steps if known.`,

  on_hold: `Generate an email to inform a candidate their application is on hold / under review.
Be transparent, professional, and give estimated timeline if provided.`,

  reference_check: `Generate a professional reference check request email to a referee.
Request feedback professionally and include context about the candidate and role.`,

  whatsapp_followup: `Generate a short, friendly WhatsApp message for a recruitment follow-up.
Use emojis appropriately, keep it brief and conversational.`,
}

async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

  if (!apiKey) throw new Error('OPENAI_API_KEY not configured. Please add it to your .env file.')

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
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`AI API error ${res.status}: ${errText}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      email_type,   // rejection | followup | interview_invite | shortlist | offer | ...
      platform,     // gmail | whatsapp | linkedin | telegram
      tone,         // formal | semi-formal | friendly | casual
      candidate_name,
      candidate_email,
      role_title,
      company_name,
      recruiter_name,
      interview_date,
      interview_format,
      salary_package,
      start_date,
      custom_notes,
      raw_input,    // for rewrite/paraphrase/reply mode
      mode,         // 'generate' | 'rewrite'
      action,       // 'generate' | 'rewrite' | 'paraphrase' | 'reply' (new granular field)
    } = body as Record<string, string>

    const effectiveAction = action ?? mode ?? 'generate'

    if (effectiveAction === 'generate' && !email_type) {
      return NextResponse.json({ error: 'email_type required for generate mode' }, { status: 400 })
    }
    if ((effectiveAction === 'rewrite' || effectiveAction === 'paraphrase' || effectiveAction === 'reply') && !raw_input) {
      return NextResponse.json({ error: 'raw_input required for rewrite/paraphrase/reply mode' }, { status: 400 })
    }

    let userMessage = ''

    if (effectiveAction === 'rewrite') {
      userMessage = `Rewrite the following message to improve clarity, flow and professionalism. Keep the same intent and key information. Platform: ${platform ?? 'Email'}. Tone: ${tone ?? 'professional'}.${custom_notes ? ` Additional instructions: ${custom_notes}` : ''}

Original message:
${raw_input}

Rewritten version:`
    } else if (effectiveAction === 'paraphrase') {
      userMessage = `Paraphrase the following message — convey the same meaning using different words and sentence structure. Platform: ${platform ?? 'Email'}. Tone: ${tone ?? 'professional'}.${custom_notes ? ` Additional instructions: ${custom_notes}` : ''}

Original message:
${raw_input}

Paraphrased version:`
    } else if (effectiveAction === 'reply') {
      userMessage = `Draft a professional reply to the following message. Platform: ${platform ?? 'Email'}. Tone: ${tone ?? 'professional'}.
${recruiter_name ? `The person replying is: ${recruiter_name}` : ''}
${candidate_name ? `Replying to: ${candidate_name}` : ''}
${role_title ? `Role context: ${role_title}` : ''}
${company_name ? `Company: ${company_name}` : ''}
${custom_notes ? `Additional instructions: ${custom_notes}` : ''}

Message to reply to:
${raw_input}

Reply:`
    } else {
      // Generate new email from scratch
      const typePrompt = EMAIL_TYPE_PROMPTS[email_type] ?? `Generate a professional recruitment email of type: ${email_type}.`
      userMessage = `${typePrompt}

Platform: ${platform ?? 'Email'}
Tone: ${tone ?? 'professional'}
${candidate_name ? `Candidate Name: ${candidate_name}` : ''}
${candidate_email ? `Candidate Email: ${candidate_email}` : ''}
${role_title ? `Role: ${role_title}` : ''}
${company_name ? `Company: ${company_name}` : ''}
${recruiter_name ? `Recruiter/Sender Name: ${recruiter_name}` : ''}
${interview_date ? `Interview Date/Time: ${interview_date}` : ''}
${interview_format ? `Interview Format: ${interview_format}` : ''}
${salary_package ? `Salary/Package: ${salary_package}` : ''}
${start_date ? `Start Date: ${start_date}` : ''}
${custom_notes ? `Additional notes: ${custom_notes}` : ''}

Generate the full message now:`
    }

    const result = await callAI(COMPOSE_SYSTEM_PROMPT, userMessage)
    return NextResponse.json({ content: result })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    console.error('[api/compose]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
