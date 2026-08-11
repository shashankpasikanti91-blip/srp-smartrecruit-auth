import * as React from 'react'
import { cn } from '@/lib/utils'

export function Badge({
  className,
  variant = 'outline',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: 'outline' | 'secondary' }) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
        variant === 'outline' && 'border border-[#166534]/25 text-[#166534]',
        variant === 'secondary' && 'bg-[#ecfdf3] text-[#166534]',
        className,
      )}
      {...props}
    />
  )
}
