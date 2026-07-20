'use client'

import Image from 'next/image'
import SolutionsScrollBlock from '@/components/marketing/ui/SolutionsScrollBlock'
import MatchExplanationMock from '@/components/marketing/visuals/MatchExplanationMock'
import ClientSubmissionMock from '@/components/marketing/visuals/ClientSubmissionMock'
import { SOLUTIONS_PAGE } from '@/content/marketing/solutions'
import { MARKETING_PHOTOS } from '@/content/marketing/photos'

type VisualType = (typeof SOLUTIONS_PAGE.scrollyBlocks)[number]['visual']

function SolutionsVisual({ type }: { type: VisualType }) {
  if (type === 'agencyCommandCenter') {
    return (
      <Image
        src={MARKETING_PHOTOS.agencyCommandCenter.src}
        alt={MARKETING_PHOTOS.agencyCommandCenter.alt}
        width={1200}
        height={800}
        className="solutions-visual-media"
        priority={false}
      />
    )
  }
  if (type === 'matchExplanation') {
    return <MatchExplanationMock />
  }
  return <ClientSubmissionMock />
}

export default function SolutionsScrollytelling() {
  return (
    <div className="solutions-scrollytelling-wrap">
      {SOLUTIONS_PAGE.scrollyBlocks.map((block, i) => (
        <div key={block.id} className={i > 0 ? 'border-t border-white/[0.04]' : ''}>
          <SolutionsScrollBlock
            id={block.id}
            heading={block.heading}
            body={block.body}
            action={block.action}
            imageSide={block.imageSide}
            visual={<SolutionsVisual type={block.visual} />}
          />
        </div>
      ))}
    </div>
  )
}
