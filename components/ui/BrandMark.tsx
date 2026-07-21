/** Circular S brand mark — SmartRecruit / SRP */
export function BrandMark({
  size = 36,
  className = '',
  animated = false,
}: {
  size?: number
  className?: string
  animated?: boolean
}) {
  const id = `srp-ring-${size}`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
      role="img"
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b5bdb" />
          <stop offset="50%" stopColor="#995af2" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${id}-g)`} />
      <circle
        cx="32" cy="32" r="26"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="2"
        strokeDasharray="40 80"
        className={animated ? 'srp-brand-spin' : undefined}
      />
      <text
        x="32"
        y="42"
        textAnchor="middle"
        fill="#fff"
        style={{ fontSize: 28, fontWeight: 800, fontFamily: "Manrope, 'Plus Jakarta Sans', system-ui, sans-serif" }}
      >
        S
      </text>
    </svg>
  )
}

export function AppSplash({
  label = 'SRP SmartRecruit',
  sub = 'AI-powered Recruitment Operating System',
  compact = false,
}: {
  label?: string
  sub?: string
  compact?: boolean
}) {
  return (
    <div
      className={`srp-splash flex flex-col items-center justify-center gap-4 ${
        compact ? 'py-16' : 'min-h-[50vh] py-20'
      }`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="relative">
        <BrandMark size={compact ? 48 : 72} animated />
        <span className="srp-splash-glow absolute inset-0 rounded-full" aria-hidden />
      </div>
      <div className="text-center px-4">
        <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          {label}
        </p>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">{sub}</p>
      </div>
    </div>
  )
}
