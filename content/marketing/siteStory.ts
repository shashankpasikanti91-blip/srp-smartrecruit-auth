import { PHOTOS } from './photos'

export const SCREEN_STORY = {
  id: 'desk',
  kicker: 'Screen',
  title: 'Drop CVs on the job. Not ten inboxes.',
  lede:
    'The pile is not the problem. The pile in five places is. One opening, one upload, one brief — then SmartRecruit reads every file against that job.',
  photo: PHOTOS.inbox,
  caption: 'The pile, on one desk',
  beats: [
    { n: '01', title: 'The pile lands once', text: 'PDF or DOCX, a batch or a drip. They attach to this opening — not a shared drive, not a recruiter’s desktop, not last week’s WhatsApp thread.' },
    { n: '02', title: 'The brief is the rule', text: 'Each file is read against this JD: skills, tenure, must-haves. A generic keyword dump is not a screen.' },
    { n: '03', title: 'The stack becomes a list', text: 'Names you can sort. Not twenty tabs of CVs you already opened once and will not open again.' },
    { n: '04', title: 'Nothing is “done” yet', text: 'Screening is intake. Match and review still sit ahead. You have not sent a name. You have only stopped losing the pile.' },
  ],
} as const

export const MATCH_STORY = {
  id: 'two',
  kicker: 'Match',
  title: 'Two people can both look right. The score says why.',
  lede:
    'A strong CV and a strong CV are not the same hire. Fit, gaps, and experience checks sit next to the name so the next recruiter does not start from a blank page.',
  photo: PHOTOS.compare,
  caption: 'Two profiles. One opening.',
  whyThis: [
    { title: 'Skills that map', text: 'Required tools and domains from the JD, not a buzzword cloud.' },
    { title: 'Tenure that holds', text: 'Years in seat vs years claimed. Gaps are visible, not buried.' },
    { title: 'A reason you can read aloud', text: 'If you cannot say why this name is high, it is not high.' },
  ],
  whyNot: [
    { title: 'Looks senior, isn’t', text: 'Title inflation shows up against the years the brief asked for.' },
    { title: 'Right stack, wrong depth', text: 'Listed the tool. Did not live in it. The gap is on the card.' },
    { title: 'You still decide', text: 'The score is an argument. It is not a send.' },
  ],
} as const

export const REVIEW_STORY = {
  id: 'product',
  kicker: 'Review',
  title: 'If you cannot say why, do not send it.',
  lede:
    'Every name that advances carries a reason you can take into a client call: what matched, what is thin, what still needs a conversation.',
  photo: PHOTOS.reason,
  bullets: [
    'Open the reason before you open the calendar.',
    'Keep, hold, or drop — while the name is still inside your desk.',
    'The next recruiter should not have to reverse-engineer your hunch.',
    'If the explanation is weak, the send is weak. Stop here.',
  ],
} as const

export const SEND_STORY = {
  id: 'signoff',
  kicker: 'Send',
  title: 'The client only sees names you approve.',
  lede:
    'Nothing leaves as an automatic pack. You mark who goes in the folder. The last inch of the desk is still yours.',
  photo: PHOTOS.handoff,
  caption: 'The last inch stays with your desk.',
  checks: [
    { title: 'You pick the folder', text: 'Shortlist is a decision, not a sort order. Names move because you moved them.' },
    { title: 'The pack is the ones you marked', text: 'Scores and notes travel with the name. The client does not get the whole pile.' },
    { title: 'No silent export', text: 'If you did not approve it, it does not leave the workspace.' },
    { title: 'You can defend it on the call', text: 'Walk in with three names and a reason for each — not a PDF dump and a hope.' },
  ],
} as const

export const JOBS_STORY = {
  id: 'jobs',
  kicker: 'Jobs',
  title: 'Openings and records live on one desk.',
  lede:
    'Job posts, candidate files, and pipeline stages sit in the workspace. The desk is the system of record — not a spreadsheet and ten folders.',
  photo: PHOTOS.hero,
  caption: 'Posts, people, and the pipeline',
  beats: [
    { n: '01', title: 'Job posts in the workspace', text: 'Each opening is a live post: brief, client, and status. CVs attach to that post — they do not float in a shared drive.' },
    { n: '02', title: 'One record per person', text: 'Contact, files, notes, and scores stay on the candidate. The next recruiter does not rebuild the file from email.' },
    { n: '03', title: 'Pipeline is the system of record', text: 'Stage, owner, and last action sit on the name. Managing the desk is managing this data — not another tracker.' },
  ],
} as const

/** @deprecated Prefer the typed story objects above */
export const CHAPTERS = [
  { id: SCREEN_STORY.id, layout: 'image-left' as const, kicker: SCREEN_STORY.kicker, title: SCREEN_STORY.title, body: SCREEN_STORY.lede, photo: SCREEN_STORY.photo },
  { id: MATCH_STORY.id, layout: 'image-right' as const, kicker: MATCH_STORY.kicker, title: MATCH_STORY.title, body: MATCH_STORY.lede, photo: MATCH_STORY.photo },
  { id: REVIEW_STORY.id, layout: 'full-bleed' as const, kicker: REVIEW_STORY.kicker, title: REVIEW_STORY.title, body: REVIEW_STORY.lede, photo: REVIEW_STORY.photo },
  { id: SEND_STORY.id, layout: 'image-left' as const, kicker: SEND_STORY.kicker, title: SEND_STORY.title, body: SEND_STORY.lede, photo: SEND_STORY.photo },
] as const

export const WEEK_STRIP = [
  {
    label: 'Screen',
    caption: 'Upload CVs to a job. One pile, one brief.',
    points: [
      'Batch lands on one opening — not ten inboxes.',
      'Each file is read against that JD.',
      'You get a list. You have not sent anyone yet.',
    ],
  },
  {
    label: 'Match',
    caption: 'Score each profile against the JD — skills, tenure, gaps.',
    points: [
      'Two strong CVs are not the same hire.',
      'Fit and gaps sit next to the name.',
      'The score is an argument, not a send.',
    ],
  },
  {
    label: 'Review',
    caption: 'Read the reason. Keep, hold, or drop before anyone else sees it.',
    points: [
      'Open the reason before the calendar.',
      'Keep, hold, or drop on your desk.',
      'If you cannot say why, it does not move.',
    ],
  },
  {
    label: 'Send',
    caption: 'Only the names you approve leave the workspace.',
    points: [
      'You mark the folder. Nothing auto-exports.',
      'The client sees approved names only.',
      'Walk into the call with names you will stand behind.',
    ],
  },
  {
    label: 'Jobs',
    caption: 'Openings and records stay in the workspace.',
    points: [
      'Job posts live here — not a side spreadsheet.',
      'Candidate data stays with the opening.',
      'Pipeline is the system of record.',
    ],
  },
] as const

export const CLOSE = {
  kicker: 'Your workspace',
  title: 'Open SmartRecruit and run the morning pile.',
  body: 'Screen, match, review, send — job posts and records on one desk — then walk into the client meeting with names you can defend.',
  cta: { label: 'Sign in', href: '/login' },
  photo: PHOTOS.close,
} as const

export const SHOWCASE = {
  eyebrow: 'How it works',
  title: 'From CV drop to a pack you will sign.',
  description: 'Job posts, records, and four steps on one desk. AI ranks. You decide who the client sees.',
  stats: ['Job posts', 'Bulk CV upload', 'JD match score', 'Recruiter sign-off'],
  steps: [
    { id: 'step-1', title: 'Drop CVs on a job', text: 'PDF or DOCX, one role at a time. Each file is read against that brief — not a generic keyword dump.' },
    { id: 'step-2', title: 'Rank against the JD', text: 'See fit, missing skills, and experience gaps next to the name so two strong profiles are not a coin toss.' },
    { id: 'step-3', title: 'You sign off', text: 'Keep, hold, or drop. Only approved names go into the pack you send.' },
    { id: 'step-4', title: 'Job posts and records', text: 'Openings live as job posts in the workspace. Candidate files, notes, and pipeline stages stay on the record — not in ten folders.' },
  ],
} as const
