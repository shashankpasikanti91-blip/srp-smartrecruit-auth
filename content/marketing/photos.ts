export const PHOTOS = {
  hero: {
    src: '/marketing/photos/hero-desk.png',
    alt: 'Recruiter screening printed CVs at a desk — SRP SmartRecruit',
  },
  inbox: {
    src: '/marketing/photos/chapter-inbox.png',
    alt: 'Stack of resumes ready to screen against a job brief in SmartRecruit',
  },
  compare: {
    src: '/marketing/photos/chapter-compare.png',
    alt: 'Recruiters matching two candidate profiles against one opening',
  },
  reason: {
    src: '/marketing/photos/chapter-reason.png',
    alt: 'Recruiter reviewing why a candidate matches the job before sending',
  },
  handoff: {
    src: '/marketing/photos/chapter-handoff.png',
    alt: 'Approved candidate pack on a conference table after recruiter sign-off',
  },
  close: {
    src: '/marketing/photos/cta-floor.png',
    alt: 'Recruitment workspace at the end of the day — SRP SmartRecruit',
  },
} as const

export const MARKETING_PHOTOS = {
  agencyCommandCenter: PHOTOS.hero,
  cvScreening: PHOTOS.inbox,
  highVolumeFloor: PHOTOS.inbox,
  humanReview: PHOTOS.reason,
  intelligenceDashboard: PHOTOS.compare,
} as const
