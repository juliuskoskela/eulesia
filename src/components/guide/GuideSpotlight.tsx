interface GuideSpotlightProps {
  targetRect: DOMRect
  padding?: number
}

export function GuideSpotlight({ targetRect, padding = 8 }: GuideSpotlightProps) {
  const x = targetRect.left - padding
  const y = targetRect.top - padding
  const w = targetRect.width + padding * 2
  const h = targetRect.height + padding * 2
  const r = 8

  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-auto"
      style={{ zIndex: 55 }}
      onClick={(e) => e.stopPropagation()}
    >
      <defs>
        <mask id="guide-spotlight-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={r}
            ry={r}
            fill="black"
          />
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0, 0, 0, 0.5)"
        mask="url(#guide-spotlight-mask)"
      />
    </svg>
  )
}
