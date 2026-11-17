import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 18, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

/** Hintlyx mark: a speech bubble with a spark. */
export const Logo = (p: IconProps) => (
  <Svg {...p} strokeWidth={2.1}>
    <path d="M4 11.5a7.5 7.5 0 0 1 7.5-7.5h1A7.5 7.5 0 0 1 20 11.5v0A7.5 7.5 0 0 1 12.5 19H7l-3 2.5v-10Z" />
    <path d="M12 8.2v6.6M8.7 11.5h6.6" />
  </Svg>
)

export const Grip = (p: IconProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    {[7, 12, 17].map((y) => (
      <g key={y}>
        <circle cx="9" cy={y} r="1.6" />
        <circle cx="15" cy={y} r="1.6" />
      </g>
    ))}
  </Svg>
)

export const Close = (p: IconProps) => (
  <Svg {...p} strokeWidth={2.4}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)

export const MicOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 9v2a3 3 0 0 0 5.1 2.1M15 10V6a3 3 0 0 0-5.7-1.3" />
    <path d="M18 11a6 6 0 0 1-.9 3.2M6 11a6 6 0 0 0 9.4 4.9M12 17v3M3 3l18 18" />
  </Svg>
)

export const Wave = (p: IconProps) => (
  <Svg {...p} strokeWidth={2.4}>
    <path d="M6 10v4M10 7v10M14 9v6M18 11v2" />
  </Svg>
)

export const StopDot = (p: IconProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <circle cx="12" cy="12" r="9" />
    <rect x="9" y="9" width="6" height="6" rx="1.2" fill="#0d1220" />
  </Svg>
)

export const PlayDot = (p: IconProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <circle cx="12" cy="12" r="9" />
    <path d="M10.2 8.6v6.8l5.4-3.4-5.4-3.4Z" fill="#0d1220" />
  </Svg>
)

export const Chevron = (p: IconProps) => (
  <Svg {...p}>
    <path d="m7 10 5 5 5-5" />
  </Svg>
)

export const Check = (p: IconProps) => (
  <Svg {...p} strokeWidth={2.4}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
)

export const Gear = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Svg>
)

export const Bolt = (p: IconProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <path d="M13.5 2 5 13.5h6L10 22l9-12h-6.2L13.5 2Z" />
  </Svg>
)

export const Lines = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </Svg>
)

export const ChatQ = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5h16v11H9l-5 4V5Z" />
    <path d="M10 9.2a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9M12 13.6h.01" />
  </Svg>
)

export const BadgeCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l2.4 1.7 2.9-.2.9 2.8 2.3 1.8-.9 2.8.9 2.8-2.3 1.8-.9 2.8-2.9-.2L12 21l-2.4-1.7-2.9.2-.9-2.8-2.3-1.8.9-2.8-.9-2.8 2.3-1.8.9-2.8 2.9.2L12 3Z" />
    <path d="m8.8 12.2 2.2 2.2 4.2-4.4" />
  </Svg>
)

export const Recap = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4.5h-4.5" />
  </Svg>
)

export const Monitor = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Svg>
)

export const Copy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Svg>
)

export const Back = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 5 8 12l7 7" />
  </Svg>
)
