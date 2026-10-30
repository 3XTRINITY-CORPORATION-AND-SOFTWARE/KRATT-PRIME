import { useEffect, useMemo, useRef, useState } from 'react'

const ACCENT = '#A855F7'
const FOOTER =
  'SYSTEM: TRINITYWAYVE | ARCHITECT: THEODOR^%°¢(KÜNNAPUU) | SOURCE: LINDA VIIDING | LÄBIMURDE ANKUR: ACTIVE | STATUS: OMNI-SOVEREIGN'

type Mode = 'bars' | 'ring' | 'wave' | 'bloom'

const MODES: Mode[] = ['bars', 'ring', 'wave', 'bloom']

function probeCaps() {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  let canvas = false
  let audio = false
  try {
    const c = document.createElement('canvas')
    canvas = !!c.getContext('2d')
  } catch {
    canvas = false
  }
  try {
    audio =
      typeof window !== 'undefined' &&
      !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext)
  } catch {
    audio = false
  }
  return {
    dpr: Math.round(dpr * 100) / 100,
    canvas,
    audio,
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<Mode>('bars')
  const [armed, setArmed] = useState(false)
  const [playing, setPlaying] = useState(true)
  const barsRef = useRef<Float32Array>(new Float32Array(64).fill(0.12))
  const modeRef = useRef(mode)
  const armedRef = useRef(armed)
  const playingRef = useRef(playing)
  modeRef.current = mode
  armedRef.current = armed
  playingRef.current = playing

  const caps = useMemo(() => probeCaps(), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let running = true
    let t0 = performance.now()

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(canvas.clientWidth * dpr)
      canvas.height = Math.floor(canvas.clientHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const drawBars = (w: number, h: number, bars: Float32Array, live: boolean) => {
      const n = bars.length
      const gap = 2
      const barW = Math.max(2, (w - 64 - gap * n) / n)
      const baseY = h * 0.78
      const maxH = h * 0.55
      for (let i = 0; i < n; i++) {
        const bh = bars[i] * maxH * (live ? 1 : 0.45)
        const x = 32 + i * (barW + gap)
        const alpha = live ? 0.85 : 0.35
        ctx.fillStyle = `rgba(168,85,247,${alpha})`
        ctx.fillRect(x, baseY - bh, barW, bh)
        ctx.fillStyle = `rgba(168,85,247,${alpha * 0.25})`
        ctx.fillRect(x, baseY - bh - 3, barW, 2)
      }
      ctx.strokeStyle = 'rgba(168,85,247,0.2)'
      ctx.beginPath()
      ctx.moveTo(24, baseY + 4)
      ctx.lineTo(w - 24, baseY + 4)
      ctx.stroke()
    }

    const drawRing = (w: number, h: number, bars: Float32Array, t: number, live: boolean) => {
      const cx = w * 0.5
      const cy = h * 0.48
      const energy = bars.reduce((a, b) => a + b, 0) / bars.length
      const rings = 6
      for (let i = 0; i < rings; i++) {
        const pulse = live ? Math.sin(t * 1.8 + i * 0.7) * 6 * energy : 0
        const r = 28 + i * 26 + pulse + energy * 18
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        const a = live ? 0.55 - i * 0.06 : 0.18
        ctx.strokeStyle = `rgba(168,85,247,${Math.max(0.08, a)})`
        ctx.lineWidth = i === 0 ? 2.4 : 1.1
        ctx.stroke()
      }
      // spoke spectrum
      const spokes = 48
      for (let i = 0; i < spokes; i++) {
        const v = bars[Math.floor((i / spokes) * bars.length)]
        const ang = (i / spokes) * Math.PI * 2 - Math.PI / 2
        const inner = 36
        const outer = inner + v * (live ? 90 : 28)
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner)
        ctx.lineTo(cx + Math.cos(ang) * outer, cy + Math.sin(ang) * outer)
        ctx.strokeStyle = `rgba(168,85,247,${live ? 0.7 : 0.25})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }

    const drawWave = (w: number, h: number, bars: Float32Array, t: number, live: boolean) => {
      const mid = h * 0.5
      const amp = live ? h * 0.28 : h * 0.08
      ctx.beginPath()
      for (let x = 0; x <= w; x += 3) {
        const i = Math.floor((x / w) * (bars.length - 1))
        const v = bars[i]
        const y =
          mid +
          Math.sin(x * 0.018 + t * 2.4) * amp * (0.35 + v) +
          Math.sin(x * 0.041 - t * 1.1) * amp * 0.25 * v
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = live ? ACCENT : 'rgba(168,85,247,0.35)'
      ctx.lineWidth = 2
      ctx.stroke()
      // ghost trail
      ctx.beginPath()
      for (let x = 0; x <= w; x += 4) {
        const i = Math.floor((x / w) * (bars.length - 1))
        const v = bars[i]
        const y =
          mid +
          Math.sin(x * 0.018 + t * 2.4 + 0.6) * amp * 0.55 * (0.35 + v)
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(168,85,247,0.25)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    const drawBloom = (w: number, h: number, bars: Float32Array, t: number, live: boolean) => {
      const cx = w * 0.5
      const cy = h * 0.48
      const energy = bars.reduce((a, b) => a + b, 0) / bars.length
      const petals = 16
      for (let i = 0; i < petals; i++) {
        const ang = (i / petals) * Math.PI * 2 + t * 0.35
        const v = bars[Math.floor((i / petals) * bars.length)]
        const reach = (live ? 70 : 28) + v * (live ? 140 : 40) + energy * 40
        const px = cx + Math.cos(ang) * reach
        const py = cy + Math.sin(ang) * reach
        const grd = ctx.createRadialGradient(cx, cy, 8, px, py, reach)
        grd.addColorStop(0, `rgba(168,85,247,${live ? 0.45 : 0.12})`)
        grd.addColorStop(0.55, `rgba(168,85,247,${live ? 0.12 : 0.04})`)
        grd.addColorStop(1, 'transparent')
        ctx.fillStyle = grd
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, reach, ang - 0.22, ang + 0.22)
        ctx.closePath()
        ctx.fill()
      }
      const core = ctx.createRadialGradient(cx, cy, 4, cx, cy, 48 + energy * 30)
      core.addColorStop(0, `rgba(255,255,255,${live ? 0.35 : 0.1})`)
      core.addColorStop(0.4, `rgba(168,85,247,${live ? 0.5 : 0.15})`)
      core.addColorStop(1, 'transparent')
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(cx, cy, 60 + energy * 40, 0, Math.PI * 2)
      ctx.fill()
    }

    const draw = (now: number) => {
      if (!running) return
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const t = (now - t0) / 1000
      const m = modeRef.current
      const isArmed = armedRef.current
      const isPlaying = playingRef.current
      const live = isArmed && isPlaying

      ctx.fillStyle = '#050505'
      ctx.fillRect(0, 0, w, h)

      // soft grid
      ctx.strokeStyle = 'rgba(168,85,247,0.04)'
      ctx.lineWidth = 1
      for (let x = 0; x < w; x += 48) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 0; y < h; y += 48) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      const bars = barsRef.current
      for (let i = 0; i < bars.length; i++) {
        let target: number
        if (!isArmed) {
          target = 0.06 + 0.04 * Math.abs(Math.sin(t * 0.4 + i * 0.12))
        } else if (!isPlaying) {
          target = bars[i] * 0.88
        } else {
          target =
            0.12 +
            0.55 * Math.abs(Math.sin(t * 2.1 + i * 0.28)) *
              (0.55 + 0.45 * Math.abs(Math.sin(t * 0.7 + i * 0.05)))
        }
        bars[i] += (target - bars[i]) * (live ? 0.22 : 0.08)
      }

      if (m === 'bars') drawBars(w, h, bars, live)
      else if (m === 'ring') drawRing(w, h, bars, t, live)
      else if (m === 'wave') drawWave(w, h, bars, t, live)
      else drawBloom(w, h, bars, t, live)

      // mode HUD chip
      ctx.font = '11px ui-monospace, monospace'
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(16, 16, 118, 20)
      ctx.strokeStyle = 'rgba(168,85,247,0.4)'
      ctx.strokeRect(16, 16, 118, 20)
      ctx.fillStyle = ACCENT
      ctx.fillText(`MODE · ${m.toUpperCase()}`, 24, 30)

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const armStage = () => {
    setArmed(true)
    setPlaying(true)
  }

  return (
    <div className="min-h-screen flex flex-col bg-void">
      <header className="border-b border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase" style={{ color: ACCENT }}>
            TrinityWayve · Module
          </p>
          <h1 className="text-xl font-bold tracking-tight">Aura</h1>
          <p className="text-xs text-white/50 mt-0.5">Lab visualizer · caps · modes</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center font-mono text-[11px]">
          <button
            type="button"
            onClick={armStage}
            className="rounded border px-3 py-1.5 uppercase tracking-wider font-medium"
            style={{
              borderColor: ACCENT,
              background: armed ? 'rgba(168,85,247,0.25)' : 'rgba(168,85,247,0.12)',
              color: ACCENT,
            }}
          >
            {armed ? 'Stage armed' : 'Arm stage'}
          </button>
          {armed && (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="rounded border border-white/15 px-2.5 py-1.5 text-white/70 hover:bg-white/5"
            >
              {playing ? 'Pause' : 'Play'}
            </button>
          )}
        </div>
      </header>

      <div className="border-b border-border px-4 py-2 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-1.5 font-mono text-[11px]" role="tablist" aria-label="Visualizer modes">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className="rounded border px-2.5 py-1 uppercase tracking-wider"
              style={{
                borderColor: mode === m ? ACCENT : '#1a1a1a',
                background: mode === m ? 'rgba(168,85,247,0.15)' : 'transparent',
                color: mode === m ? ACCENT : 'rgba(255,255,255,0.55)',
              }}
            >
              {m}
            </button>
          ))}
        </div>
        <div
          className="rounded border border-border bg-black/60 px-2.5 py-1 font-mono text-[10px] text-white/55"
          title="Honest browser capability probe — no marketing claims"
        >
          <span style={{ color: ACCENT }}>Browser caps disclosed</span>
          <span className="text-white/25 mx-1.5">·</span>
          <span>dpr {caps.dpr}</span>
          <span className="text-white/25 mx-1.5">·</span>
          <span>canvas {caps.canvas ? 'ok' : 'no'}</span>
          <span className="text-white/25 mx-1.5">·</span>
          <span>audioCtx {caps.audio ? 'ok' : 'no'}</span>
        </div>
      </div>

      <main className="flex-1 relative min-h-[320px]">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
        <div className="absolute right-4 bottom-4 rounded-md border border-border bg-black/70 px-3 py-2 font-mono text-[11px] text-white/60 backdrop-blur max-w-xs">
          <div>
            Mode: <span style={{ color: ACCENT }}>{mode}</span>
            <span className="text-white/25 mx-1.5">·</span>
            {armed ? (playing ? 'live' : 'paused') : 'idle'}
          </div>
          <div className="text-white/35 mt-1">Simulated spectrum — no mic required</div>
        </div>
      </main>

      <footer className="border-t border-border px-4 py-2 font-mono text-[9px] tracking-wide text-white/35 overflow-x-auto whitespace-nowrap">
        {FOOTER} | DEMO SHELL
      </footer>
    </div>
  )
}
