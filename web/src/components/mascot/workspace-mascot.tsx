import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

const STORAGE_KEY = 'workspace-mascot-position'

type Point = { right: number; bottom: number }

const MOODS = ['idle', 'thinking', 'happy'] as const

const MOOD_LABELS: Record<(typeof MOODS)[number], string> = {
  idle: 'Mascot is idle',
  thinking: 'Mascot is thinking',
  happy: 'Mascot is happy',
}

const MOOD_EYE_RADIUS: Record<(typeof MOODS)[number], number> = {
  idle: 7,
  thinking: 5,
  happy: 8,
}

export function WorkspaceMascot() {
  const { t } = useTranslation()
  const [point, setPoint] = useState<Point>({ right: 20, bottom: 20 })
  const [open, setOpen] = useState(false)
  const [mood, setMood] = useState<(typeof MOODS)[number]>('idle')
  const drag = useRef<{ x: number; y: number; right: number; bottom: number; moved: boolean } | null>(null)
  const pointRef = useRef(point)
  pointRef.current = point

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const saved = JSON.parse(raw) as Point
      if (typeof saved.right === 'number' && typeof saved.bottom === 'number') setPoint(saved)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, right: point.right, bottom: point.bottom, moved: false }
  }

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = drag.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.hypot(dx, dy) > 4) start.moved = true
    const next = {
      right: Math.max(8, start.right - dx),
      bottom: Math.max(8, start.bottom - dy),
    }
    pointRef.current = next
    setPoint(next)
  }

  const onPointerUp = () => {
    const start = drag.current
    drag.current = null
    if (!start) return
    if (start.moved) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pointRef.current))
      return
    }
    setMood((current) => MOODS[(MOODS.indexOf(current) + 1) % MOODS.length])
    setOpen((value) => !value)
  }

  const label = t(MOOD_LABELS[mood])

  return (
    <div className='pointer-events-none fixed z-[70] flex flex-col items-end gap-1.5' style={{ right: point.right, bottom: point.bottom }}>
      {open ? (
        <div className='bg-background pointer-events-auto mb-1 w-44 rounded-2xl border px-3 py-2 text-sm shadow-lg'>
          <p className='font-medium'>{t('Mascot')}</p>
          <p className='text-muted-foreground text-xs'>{label}</p>
        </div>
      ) : null}
      <button
        type='button'
        aria-label={t('Open mascot status')}
        className='pointer-events-auto block cursor-grab touch-none rounded-full transition-transform hover:scale-105 active:cursor-grabbing'
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <MascotFace mood={mood} />
      </button>
    </div>
  )
}

function MascotFace(props: { mood: (typeof MOODS)[number] }) {
  const eye = MOOD_EYE_RADIUS[props.mood]
  return (
    <svg width='78' height='78' viewBox='-160 -160 320 320' role='img'>
      <defs>
        <filter id='workspace-mascot-noise'>
          <feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' result='noise' />
          <feColorMatrix type='saturate' values='0' />
        </filter>
      </defs>
      <circle cx='0' cy='8' r='108' fill='#171717' />
      <circle cx='-36' cy='-8' r={eye} fill='white' />
      <circle cx='36' cy='-8' r={eye} fill='white' />
      <circle cx='-34' cy='-6' r='3' fill='#171717' />
      <circle cx='38' cy='-6' r='3' fill='#171717' />
      {props.mood === 'happy' ? (
        <path d='M-28 28 Q0 52 28 28' fill='none' stroke='white' strokeWidth='6' strokeLinecap='round' />
      ) : (
        <path d='M-18 34 H18' fill='none' stroke='white' strokeWidth='6' strokeLinecap='round' />
      )}
      <rect x='-160' y='-160' width='320' height='320' filter='url(#workspace-mascot-noise)' opacity='0.28' style={{ mixBlendMode: 'soft-light' }} />
    </svg>
  )
}
