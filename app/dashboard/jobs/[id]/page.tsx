'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Job360View } from '@/components/recruitment/Job360View'

export default function Job360Page() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const search = useSearchParams()
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
        const tab = search.get('from') || tool
        router.push(`/dashboard?tab=${encodeURIComponent(tab)}&job_post_id=${encodeURIComponent(jobId)}`)
      }}
    />
  )
}
