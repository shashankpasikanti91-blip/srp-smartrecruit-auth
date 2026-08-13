'use client'

import { useParams, useRouter } from 'next/navigation'
import { Job360View } from '@/components/recruitment/Job360View'

export default function Job360Page() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const jobId = params?.id

  if (!jobId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600 font-semibold">
        Job not found
      </div>
    )
  }

  return (
    <Job360View
      jobId={jobId}
      variant="page"
      onClose={() => router.push('/dashboard?tab=jobs')}
      onOpenCandidate={(id) => router.push(`/dashboard/candidates/${id}`)}
      onNavigate={(tool) => {
        // Always open the requested AI tool with this job — never let ?from= override the tab
        router.push(`/dashboard?tab=${encodeURIComponent(tool)}&job_post_id=${encodeURIComponent(jobId)}`)
      }}
    />
  )
}
