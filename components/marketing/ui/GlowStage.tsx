import { type ReactNode } from 'react'

export default function GlowStage({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <div className={`absolute inset-0 pointer-events-none glow-orbit-bg ${className}`} aria-hidden>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-[100px]" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-cyan-500/8 blur-[80px]" />
      {children}
    </div>
  )
}
