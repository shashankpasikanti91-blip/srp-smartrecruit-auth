/** Approved trust language for public marketing — use these instead of unverified claims. */

export const APPROVED_TRUST_POINTS = [
  'Candidate data protection with tenant-scoped access',
  'Role-based workspace permissions',
  'Activity audit logs for screening actions',
  'Human review before client submission',
  'TLS encryption in transit',
] as const

/** Phrases that must not appear on marketing pages without proof. */
export const BANNED_CLAIMS = [
  '95% accuracy',
  '95% AI Match',
  'zero manual effort',
  'Zero manual effort',
  '10× faster',
  '75% faster',
  'hire 3× faster',
  'SOC 2 Type II certified',
  'GDPR Compliant',
  'ISO 27001-certified',
] as const

export const CLAIM_REPLACEMENTS: Record<string, string> = {
  '95% AI Match Accuracy': 'Structured AI scoring with explanations',
  'Zero manual effort': 'Human-in-the-loop review',
  '10× faster': 'Faster shortlist preparation',
  '75% faster': 'Built for high-volume agency workflows',
  'hire 3× faster': 'Move from upload to shortlist with less manual screening',
}
