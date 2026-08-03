/**
 * AI Screening v2.0 shared types — additive over legacy ScreenResult fields.
 */

export type ScreeningClassification = 'EXCELLENT' | 'STRONG' | 'KAV' | 'HOLD' | 'REJECT'
export type ScreeningDecision = 'Excellent' | 'Shortlisted' | 'Hold' | 'Rejected' | string
export type ScreeningRecommendation = 'Hire' | 'Hold' | 'Reject' | string
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Very High' | string
export type RequirementStatus = 'matched' | 'missing' | 'partial'

export type MandatoryRequirement = {
  name: string
  tier?: 'mandatory' | 'strong' | 'preferred'
  status: RequirementStatus
  confidence?: number
  evidence?: string
}

export type SkillEvidence = {
  skill: string
  company?: string
  role?: string
  dates?: string
  quote?: string
  verified?: boolean
}

export type JdIntelligence = {
  job_summary?: string
  job_title?: string
  industry?: string
  department?: string
  employment_type?: string
  seniority?: string
  minimum_experience?: string
  education_requirement?: string
  mandatory?: string[]
  strong?: string[]
  preferred?: string[]
  soft_skills?: string[]
  business_responsibilities?: string[]
}

export type ResumeAudit = {
  experience_order_ok?: boolean
  date_format_ok?: boolean
  grammar_ok?: boolean
  formatting_ok?: boolean
  education_complete?: boolean
  quantified_achievements?: boolean
  technical_detail_ok?: boolean
  resume_length_ok?: boolean
  overall_quality_score?: number
  notes?: string[]
}

export type RecruiterRecommendation = {
  suitable_roles?: string[]
  interview_recommendation?: string
  hiring_recommendation?: string
  training_recommendation?: string
}

export type ScreenResult = {
  name?: string
  email?: string
  contact_number?: string
  current_company?: string
  current_designation?: string
  score?: number
  decision?: ScreeningDecision
  classification?: ScreeningClassification | 'STRONG' | 'KAV' | 'REJECT'
  recommendation?: ScreeningRecommendation
  executive_summary?: string
  hiring_reasoning?: string
  resume_score?: number
  interview_probability?: number
  offer_probability?: number
  experience_audit?: {
    claimed_years?: number
    calculated_years?: number
    difference_years?: number
    verdict?: string
    recent?: boolean
    chronological?: boolean
    current_employer?: string
    current_role?: string
  }
  date_format_check?: {
    month_year_used?: boolean
    year_only_entries?: string[]
  }
  experience_order?: {
    proper_descending?: boolean
    flag?: string
  }
  gap_analysis?: {
    total_missing_months?: number
    gaps?: Array<{ from?: string; to?: string; months?: number; reason?: string }>
  }
  jd_match?: {
    match_percent?: number
    matching_skills?: string[]
    missing_skills?: string[]
    optional_skills_match?: string[]
  }
  jd_intelligence?: JdIntelligence
  mandatory_requirements?: MandatoryRequirement[]
  strong_skills?: string[]
  preferred_skills?: string[]
  skill_evidence?: SkillEvidence[]
  skill_authenticity?: { verified?: string[]; unverified?: string[]; outdated?: string[] }
  education_check?: {
    degree_present?: boolean
    passout_year_present?: boolean
    month_available?: boolean
    flag?: string
  }
  resume_audit?: ResumeAudit
  red_flags?: string[]
  required_actions?: string[]
  required_improvements?: string[]
  recruiter_recommendation?: RecruiterRecommendation
  evaluation?: {
    candidate_strengths?: string[]
    candidate_weaknesses?: string[]
    low_or_missing_match_skills?: string[]
    high_match_skills?: string[]
    medium_match_skills?: string[]
    risk_level?: RiskLevel
    risk_explanation?: string
    reward_level?: string
    reward_explanation?: string
    justification?: string
    overall_fit_rating?: number
    strengths?: string[]
    weaknesses?: string[]
    missing_skills?: string[]
  }
  db_id?: string
  short_id?: string
  candidate_id?: string
  screened_at?: string
  filename?: string
  cached?: boolean
  persisted?: boolean
  draft?: boolean
  raw_text?: string
  /** Client-only stable key for Save/Discard list updates */
  _draftKey?: string
  error?: string
  generation?: {
    status?: string
    generated_at?: string
    model?: string
    tokens?: number
    duration_ms?: number
  }
}

export function normalizeDecisionBands(score: number): {
  decision: string
  classification: string
  recommendation: string
} {
  if (score >= 85) return { decision: 'Excellent', classification: 'EXCELLENT', recommendation: 'Hire' }
  if (score >= 70) return { decision: 'Shortlisted', classification: 'STRONG', recommendation: 'Hire' }
  if (score >= 60) return { decision: 'Hold', classification: 'KAV', recommendation: 'Hold' }
  return { decision: 'Rejected', classification: 'REJECT', recommendation: 'Reject' }
}
