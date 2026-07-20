import Image from 'next/image'

type MarketingVisualProps = {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
}

/** Renders marketing SVG/PNG with required alt text. */
export default function MarketingVisual({
  src,
  alt,
  width = 560,
  height = 400,
  className = '',
  priority = false,
}: MarketingVisualProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={`w-full h-auto max-w-full ${className}`}
    />
  )
}
