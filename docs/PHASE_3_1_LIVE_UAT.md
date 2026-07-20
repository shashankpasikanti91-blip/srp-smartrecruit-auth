# Phase 3.1 — Live UAT (highest priority)

**Goal:** Prove the live product with realistic recruiter work before cutting `v1.0.0`.  
**Environment:** Staging preferred; production only after backup + owner sign-off.  
**Rule:** Every step must update Timeline, Audit, Candidate 360, Client 360, Job 360, Dashboard, AI, Notifications where applicable.

Use this checklist. Mark `[x]` only when verified in the UI (not only via API).

---

## Pre-flight (mandatory)

- [ ] `srp-backup` completed; note path: `________________`
- [ ] `/api/health` = 200
- [ ] Login works for workspace owner + recruiter (password / Google unchanged)
- [ ] Tenant row counts recorded (tenants / members / candidates)
- [ ] `COMM_WEBHOOK_SECRET` set in production env
- [ ] OpenAI / OpenRouter key present for AI tests

---

## Scenario 1 — Malaysia Local (happy path)

Country: **MY** · Employment: **Local**

| Step | Action | Pass |
|------|--------|------|
| 1 | Create Requirement / Client | [ ] |
| 2 | Create Job (KL role) | [ ] |
| 3 | Add Candidate | [ ] |
| 4 | Screen Candidate | [ ] |
| 5 | Submit to Client | [ ] |
| 6 | Schedule Interview | [ ] |
| 7 | Complete Interview | [ ] |
| 8 | Select Candidate | [ ] |
| 9 | Upload docs (IC, EPF, SOCSO, payslips, bank, photo, education, offer) | [ ] |
| 10 | Release Offer | [ ] |
| 11 | Candidate Accepts | [ ] |
| 12 | Joining Follow-up | [ ] |
| 13 | Onboard / Joined | [ ] |

### Per-step OS checks (Scenario 1)

| Surface | Pass |
|---------|------|
| Timeline | [ ] |
| Audit log | [ ] |
| Candidate 360 | [ ] |
| Client 360 | [ ] |
| Job 360 | [ ] |
| Dashboard KPIs | [ ] |
| AI / Agent Inbox | [ ] |
| Notifications | [ ] |

**Notes:** _______________________________________________

---

## Scenario 2 — Malaysia Foreign (Employment Pass)

Country: **MY** · Employment: **Foreign**

Required document pack:

- [ ] Passport
- [ ] Visa
- [ ] Employment Pass / EP
- [ ] Passport copy
- [ ] Photo
- [ ] Medical
- [ ] Bestinet (optional)
- [ ] Immigration documents (optional)
- [ ] Offer letter
- [ ] Education

| Check | Pass |
|-------|------|
| Checklist loads MY Foreign slots | [ ] |
| Offer workflow completes | [ ] |
| Visa/EP expiry reminder rules apply | [ ] |
| Timeline + audit + notifications | [ ] |

**Notes:** _______________________________________________

---

## Scenario 3 — India

Country: **IN**

- [ ] 10th / 12th / Degree
- [ ] Aadhaar
- [ ] PAN
- [ ] UAN / PF
- [ ] Form 16 (optional)
- [ ] Offer letter
- [ ] Relieving letter (optional)
- [ ] Bank + photo

| Check | Pass |
|-------|------|
| Checklist correct for IN | [ ] |
| Offer + joining reminders | [ ] |
| OS surfaces updated | [ ] |

**Notes:** _______________________________________________

---

## Scenario 4 — Singapore

Country: **SG**

- [ ] FIN / NRIC
- [ ] Passport
- [ ] Employment Pass
- [ ] CPF
- [ ] Education
- [ ] Medical / payslips as configured

| Check | Pass |
|-------|------|
| Checklist correct for SG | [ ] |
| Offer workflow | [ ] |
| OS surfaces updated | [ ] |

**Notes:** _______________________________________________

---

## Scenario 5 — Candidate drops / branch paths

Each branch must leave a clear stage, timeline event, audit row, and notification.

| Branch | How to trigger | Pass |
|--------|----------------|------|
| Client rejects | Submission → `rejected` | [ ] |
| Candidate rejects | Submission → `rejected_by_candidate` | [ ] |
| Interview no-show | Interview → `no_show` | [ ] |
| Offer declined | Offer → `offer_rejected` / declined | [ ] |
| Document pending | Leave docs unverified; AI “missing documents” | [ ] |
| Position on hold | Submission → `hold` | [ ] |

**Notes:** _______________________________________________

---

## AI validation (5–10 prompts)

Score each: Accuracy · Tone · Recruitment relevance · Hallucinations · Tenant isolation (1–5).

| # | Prompt | Acc | Tone | Rel | Hall | Isol | Pass |
|---|--------|-----|------|-----|------|------|------|
| 1 | Generate Java Developer JD for Kuala Lumpur | | | | | | [ ] |
| 2 | Generate SAP FICO Boolean Search | | | | | | [ ] |
| 3 | Compare Candidate A and Candidate B | | | | | | [ ] |
| 4 | Generate WhatsApp for interview reminder | | | | | | [ ] |
| 5 | Candidate joining tomorrow | | | | | | [ ] |
| 6 | Which candidates have missing documents? | | | | | | [ ] |
| 7 | Show interviews awaiting feedback | | | | | | [ ] |
| 8 | Source Data Engineers in Singapore | | | | | | [ ] |
| 9 | Generate rejection email | | | | | | [ ] |
| 10 | Why is this role difficult to fill? | | | | | | [ ] |

Fail if answers invent other tenants’ data or generic chatbot fluff.

---

## UI / UX validation

Review every primary page:

| Check | Pass |
|-------|------|
| Typography consistent | [ ] |
| Bold page titles | [ ] |
| Dropdown arrows on filters | [ ] |
| Filter usability | [ ] |
| Button consistency | [ ] |
| Empty states (not blank white) | [ ] |
| Loading states | [ ] |
| Mobile responsiveness (`/m` + dashboard) | [ ] |
| Dashboard readability | [ ] |
| No unfinished / placeholder screens | [ ] |

---

## Performance (enterprise smoke volumes)

Suggested seed (adjust if already larger in prod — do **not** delete existing data):

| Entity | Target |
|--------|--------|
| Clients | 10 |
| Jobs | 100 |
| Recruiters | 5–50 |
| Candidates | 10+ (scale up if safe on staging) |
| Submissions | 5+ |
| Interviews | 5+ |
| Offers | 5+ |

| Metric | Target | Actual | Pass |
|--------|--------|--------|------|
| Dashboard load | < 3s | | [ ] |
| Candidate search | < 2s | | [ ] |
| Candidate 360 | < 3s | | [ ] |
| Job 360 | < 3s | | [ ] |
| Reports | < 5s | | [ ] |
| AI response | < 20s | | [ ] |

---

## Security

| Check | Pass |
|-------|------|
| Tenant isolation (no cross-workspace rows) | [ ] |
| Role permissions (viewer cannot mutate) | [ ] |
| API authorization (401/403 without session) | [ ] |
| Audit trails on mutations | [ ] |
| Document download tenant-scoped | [ ] |
| Notification create cannot spam other users | [ ] |
| Webhook rejects without secret in production | [ ] |

---

## Sign-off

| Role | Name | Date | Decision |
|------|------|------|----------|
| Product / Owner | | | Pass / Fail |
| Lead Recruiter | | | Pass / Fail |
| Engineering | | | Pass / Fail |

**Only if all three Pass:** create `v1.0.0`, push `main`, deploy with required backup, verify production health + login.
