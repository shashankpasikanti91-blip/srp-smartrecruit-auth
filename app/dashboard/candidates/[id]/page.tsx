'use client'

import { useParams, useRouter } from 'next/navigation'
import { Candidate360PageView } from '@/components/candidates/Candidate360PageView'

export default function Candidate360Page() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const candidateId = params?.id

  if (!candidateId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600 font-semibold">
        Candidate not found
      </div>
    )
  }

  return (
    <Candidate360PageView
      candidateId={candidateId}
      onClose={() => router.push('/dashboard?tab=candidates')}
      onOpenJob={(jobId) => router.push(`/dashboard/jobs/${jobId}`)}
    />
  )
}
