/** Times Bold S in a forest circle — same glyph as the SRP / Smart wordmark. */
const TIMES_S =
  'M41.39 13L42.19 13L42.48 25.1L41.39 25.1Q40.61 20.55 37.57 17.78Q34.53 15.01 31 15.01Q28.26 15.01 26.67 16.47Q25.08 17.93 25.08 19.83Q25.08 21.03 25.64 21.97Q26.42 23.23 28.13 24.46Q29.39 25.35 33.94 27.59Q40.32 30.73 42.54 33.51Q44.73 36.3 44.73 39.89Q44.73 44.44 41.19 47.72Q37.64 51 32.17 51Q30.46 51 28.93 50.65Q27.41 50.3 25.1 49.34Q23.82 48.8 22.99 48.8Q22.29 48.8 21.52 49.34Q20.74 49.88 20.26 50.97L19.27 50.97L19.27 37.26L20.26 37.26Q21.44 43.05 24.8 46.09Q28.16 49.13 32.04 49.13Q35.04 49.13 36.82 47.49Q38.6 45.86 38.6 43.69Q38.6 42.4 37.92 41.2Q37.24 39.99 35.84 38.91Q34.45 37.82 30.92 36.08Q25.96 33.65 23.79 31.93Q21.62 30.22 20.46 28.1Q19.29 25.99 19.29 23.44Q19.29 19.11 22.48 16.05Q25.67 13 30.51 13Q32.28 13 33.94 13.43Q35.2 13.75 37.01 14.62Q38.82 15.49 39.54 15.49Q40.23 15.49 40.64 15.06Q41.04 14.63 41.39 13Z'

export function BrandMark({
  size = 36,
  className = '',
  animated = false,
}: {
  size?: number
  className?: string
  animated?: boolean
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
      role="img"
    >
      <circle cx="32" cy="32" r="32" fill="#166534" />
      <path fill="#FCFCFA" d={TIMES_S} />
      {animated && (
        <circle
          cx="32"
          cy="32"
          r="29"
          fill="none"
          stroke="#FCFCFA"
          strokeWidth="1.5"
          opacity="0.35"
        />
      )}
    </svg>
  )
}

export function AppSplash({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`srp-splash flex flex-col items-center justify-center gap-6 ${
        compact ? 'py-16' : 'min-h-[50vh] py-20'
      }`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <BrandMark size={compact ? 72 : 96} animated />
      <div className="w-44" aria-hidden>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#166534]/20">
          <div className="srp-splash-bar h-full rounded-full bg-[#F97316]" />
        </div>
        <p className="mt-2 text-center text-xs font-semibold tabular-nums text-[#166534]">100%</p>
      </div>
    </div>
  )
}
