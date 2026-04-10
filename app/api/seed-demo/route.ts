/**
 * POST /api/seed-demo
 * Seeds realistic demo jobs + candidates for the current user.
 * Safe to call multiple times — skips if demo data already exists.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pool } from '@/lib/db'

const DEMO_JOBS = [
  {
    title: 'Senior React Developer',
    company: 'SRP AI Labs',
    location: 'Hyderabad / Remote',
    type: 'full-time',
    description:
      'We are looking for a Senior React Developer to join our growing product team. You will work on our flagship SRP AI platform, building performant, scalable frontend experiences. Collaborate closely with designers and backend engineers to ship high-quality features.',
    requirements:
      '5+ years of React experience, TypeScript, Node.js, REST APIs, Git. Experience with Next.js a plus. Strong system design and problem-solving skills required.',
  },
  {
    title: 'Digital Marketing Manager',
    company: 'SRP AI Labs',
    location: 'Hyderabad',
    type: 'full-time',
    description:
      'Lead our digital marketing efforts across SEO, paid media, content, and social channels. Drive brand awareness and lead generation for our SaaS products. You will own the full marketing funnel and report directly to the CMO.',
    requirements:
      '4+ years in digital marketing, Google Ads, Meta Ads, SEO/SEM, content strategy, analytics (GA4). Team management experience preferred.',
  },
  {
    title: 'Business Development Executive',
    company: 'SRP AI Labs',
    location: 'Mumbai / Remote',
    type: 'full-time',
    description:
      "Join our fast-growing business development team to identify, qualify, and close new enterprise accounts. You'll manage the full sales cycle from outbound prospecting through to deal closure and handoff to customer success.",
    requirements:
      '2–5 years in B2B sales or business development. Excellent communication, CRM experience (Salesforce / HubSpot), proven track record of meeting or exceeding quota.',
  },
]

const DEMO_CANDIDATES = [
  {
    jobIndex: 0,
    candidate_name: 'Priya Sharma',
    candidate_email: 'priya.sharma@demo.com',
    candidate_phone: '+91 98765 43210',
    ai_score: 88,
    match_category: 'best',
    pipeline_stage: 'screening',
    ai_skills: ['React', 'TypeScript', 'Next.js', 'Node.js', 'REST APIs', 'Git'],
    ai_summary:
      'Strong Senior React developer with 6 years of experience currently at TCS. Excellent TypeScript and Next.js skills, very close match for the JD requirements. Highly recommended to proceed.',
    status: 'reviewed',
  },
  {
    jobIndex: 0,
    candidate_name: 'Arjun Mehta',
    candidate_email: 'arjun.mehta@demo.com',
    candidate_phone: '+91 91234 56789',
    ai_score: 42,
    match_category: 'poor',
    pipeline_stage: 'applied',
    ai_skills: ['React', 'JavaScript', 'HTML', 'CSS'],
    ai_summary:
      'Only 1.5 years of React experience; missing TypeScript and Next.js. Does not meet the 5-year senior requirement. Not suitable for this role at this time.',
    status: 'reviewed',
  },
  {
    jobIndex: 1,
    candidate_name: 'Neha Gupta',
    candidate_email: 'neha.gupta@demo.com',
    candidate_phone: '+91 99887 76655',
    ai_score: 84,
    match_category: 'best',
    pipeline_stage: 'interview',
    ai_skills: ['SEO', 'Google Ads', 'Meta Ads', 'Content Strategy', 'GA4', 'SEM'],
    ai_summary:
      'Seven years of digital marketing experience leading multi-channel campaigns for fintech brands. Proficient in all required tools. Strong candidate — recommended for final round.',
    status: 'reviewed',
  },
  {
    jobIndex: 2,
    candidate_name: 'Rahul Kumar',
    candidate_email: 'rahul.kumar@demo.com',
    candidate_phone: '+91 93456 78901',
    ai_score: 68,
    match_category: 'good',
    pipeline_stage: 'screening',
    ai_skills: ['B2B Sales', 'CRM', 'Salesforce', 'Negotiation', 'Cold Outreach'],
    ai_summary:
      '3 years in B2B SaaS sales, met quota in 2 of 3 years. Good communicator. Some gaps in enterprise deal closure but trainable. Proceed with caution.',
    status: 'reviewed',
  },
  {
    jobIndex: 0,
    candidate_name: 'Ananya Singh',
    candidate_email: 'ananya.singh@demo.com',
    candidate_phone: '+91 94567 80123',
    ai_score: 93,
    match_category: 'best',
    pipeline_stage: 'offer',
    ai_skills: ['React', 'TypeScript', 'Next.js', 'GraphQL', 'AWS', 'Node.js', 'System Design'],
    ai_summary:
      'Eight years of React expertise, currently Senior SDE at Amazon. Outstanding TypeScript, Next.js, and system design skills. Top candidate — prioritise closing quickly.',
    status: 'reviewed',
  },
]

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const userRes = await pool.query<{ id: string }>(
      'SELECT id FROM auth_users WHERE email = $1',
      [session.user.email]
    )
    const userId = userRes.rows[0]?.id
    if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Skip if demo jobs already exist for this user
    const existing = await pool.query(
      `SELECT COUNT(*) AS c FROM job_posts WHERE user_id = $1 AND company = 'SRP AI Labs'`,
      [userId]
    )
    if (parseInt(existing.rows[0].c) >= 3) {
      return NextResponse.json({ message: 'Demo data already exists', skipped: true })
    }

    // Insert demo jobs
    const jobIds: string[] = []
    for (const job of DEMO_JOBS) {
      const res = await pool.query<{ id: string }>(
        `INSERT INTO job_posts (user_id, title, company, location, type, description, requirements, status, ai_generated, tags, applications_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'active',false,'{}',0) RETURNING id`,
        [userId, job.title, job.company, job.location, job.type, job.description, job.requirements]
      )
      jobIds.push(res.rows[0].id)
    }

    // Insert demo candidates
    for (const c of DEMO_CANDIDATES) {
      const jobId = jobIds[c.jobIndex]
      await pool.query(
        `INSERT INTO resumes
           (user_id, job_post_id, candidate_name, candidate_email, candidate_phone,
            ai_score, match_category, pipeline_stage, ai_skills, ai_summary, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)`,
        [
          userId, jobId,
          c.candidate_name, c.candidate_email, c.candidate_phone,
          c.ai_score, c.match_category, c.pipeline_stage,
          JSON.stringify(c.ai_skills), c.ai_summary, c.status,
        ]
      )
    }

    return NextResponse.json({
      message: 'Demo data seeded successfully',
      jobs: jobIds.length,
      candidates: DEMO_CANDIDATES.length,
    })
  } catch (err) {
    console.error('[api/seed-demo]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
