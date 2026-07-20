# Recruitment Operating System — vision ↔ implementation

SRP SmartRecruit is an **AI-powered Recruitment Operating System**, not a generic ATS.

Canonical docs: [docs/INDEX.md](docs/INDEX.md)

---

## Lifecycle

```
Requirement → Job → Source → Screen → Submit → Interview → Select
    → Documents → Offer → Accept → Joining follow-up → Onboard → Employee
```

Every stage owns: **data · documents · timeline · reminders · status history · audit · notifications**.

Branch paths (must work): client reject · candidate reject · no-show · offer declined · docs pending · position on hold.

---

## Module map

| Module | Status | Primary code |
|--------|--------|--------------|
| Submission (`SUB-YYYY-######`) | Shipped | `app/api/submissions/**`, `SubmissionsTab` |
| Interview (`INT-…`) | Shipped | `app/api/interviews/**`, `InterviewsTab` |
| Offer & Onboarding | Shipped | `app/api/offers/**`, `SelectedPipelineTab` |
| Multi-country checklists | Shipped | `lib/recruitmentOs.ts` `getDocumentChecklist`, HR Config |
| Candidate 360° | Shipped | Candidate 360 tabs + timeline / audit / docs / AI fit |
| Client 360° / Job 360° | Shipped | `Client360View`, `Job360View` |
| Follow-up / reminder engine | Shipped | `lib/reminderEngine.ts`, HR Config sweep |
| AI Recruit Copilot | Shipped | `/api/coach`, `AiRecruiterWorkspace` |
| Comms Hub | Shipped | `CommsHubTab`, `/api/comm` |
| Dashboard / reports | Shipped | `/api/dashboard/insights`, `/api/reports` |
| Mobile manager | Shipped | `/m` |
| Agent collaboration | Shipped | `lib/agentCollaboration.ts` (recommend only) |

---

## Country document packs

| Country | Employment | Required highlights |
|---------|------------|---------------------|
| Malaysia | Local | IC, EPF, SOCSO, payslips, bank, photo, education, offer |
| Malaysia | Foreign | Passport, visa, EP, medical, Bestinet/immigration optional |
| India | Local | Aadhaar, PAN, education, bank, offer; UAN/PF/Form16/relieving optional |
| Singapore | — | Passport, education; FIN/NRIC/EP/CPF as applicable |
| AU / CA / AE | — | Packs in `getDocumentChecklist` |

HR Admin configures templates via **HR Config** — no hardcoding in UI flows.

---

## AI Copilot expectations

Responds as a **Senior Recruitment Director**:

- Full JD packs (skills, salary guidance, boolean, LinkedIn/JobStreet, interview Qs, hiring difficulty)
- Compare candidates with recommendation + risk
- WhatsApp / rejection / invite copy ready to send
- Missing documents / joining this week from **tenant SQL RAG**
- Never invent other tenants’ data

---

## UI standards

- Bold dark page titles and section headings  
- Bold table headers  
- Dropdown arrows on filters  
- Consistent buttons / spacing  
- Empty + loading states on every list  
- Mobile-usable dashboard and `/m` approvals  
- No unfinished placeholder screens in navigation  

---

## Release path

1. Keep `v1.0.0-rc1` internal.  
2. Run [Phase 3.1 Live UAT](docs/PHASE_3_1_LIVE_UAT.md).  
3. Backup → migrate (additive) → deploy app only.  
4. Cut `v1.0.0` only after Pass + owner approval.
