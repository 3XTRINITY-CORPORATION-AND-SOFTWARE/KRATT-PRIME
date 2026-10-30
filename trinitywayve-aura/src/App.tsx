import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { COLOR_BANK, rgba, templateById } from './lib/colorBank'
import {
  clearHistory,
  defaultLive,
  loadHistory,
  loadPresets,
  pushHistory,
  savePresets,
  type HistoryEntry,
  type LiveMemory,
  type MemoryPreset,
} from './lib/memory'
import {
  DOWNLOAD_PROFILE,
  captureCanvasBlob,
  extForMime,
  probeCapture,
  triggerDownload,
} from './lib/download'
import { applyFile, emptyTracks, firstAnalyserCandidate } from './lib/tracks'
import { MODES, type Mode, type TrackSlot, type TrackState } from './lib/types'

const ACCENT = '#A855F7'
const FOOTER =
  'SYSTEM: TRINITYWAYVE | ARCHITECT: THEODOR^%°¢(KÜNNAPUU) | SOURCE: LINDA VIIDING | LÄBIMURDE ANKUR: ACTIVE | STATUS: OMNI-SOVEREIGN'

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

function fmtTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return String(ts)
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

  const [mode, setMode] = useState<Mode>('bars')
  const [armed, setArmed] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [paletteId, setPaletteId] = useState('void-violet')
  const [tracks, setTracks] = useState<[TrackState, TrackState, TrackState]>(() => emptyTracks())
  const [spectrumSource, setSpectrumSource] = useState<'sim' | 'A' | 'B' | 'C'>('sim')
  const [presets, setPresets] = useState<MemoryPreset[]>(() => loadPresets())
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  const [presetName, setPresetName] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [captureMsg, setCaptureMsg] = useState<string | null>(null)
  const [magId, setMagId] = useState<string | null>(null)

  const barsRef = useRef<Float32Array>(new Float32Array(64).fill(0.12))
  const modeRef = useRef(mode)
  const armedRef = useRef(armed)
  const playingRef = useRef(playing)
  const paletteRef = useRef(paletteId)
  const spectrumRef = useRef(spectrumSource)
  modeRef.current = mode
  armedRef.current = armed
  playingRef.current = playing
  paletteRef.current = paletteId
  spectrumRef.current = spectrumSource

  const caps = useMemo(() => probeCaps(), [])
  const captureCaps = useMemo(() => probeCapture(), [])
  const palette = useMemo(() => templateById(paletteId), [paletteId])

  const live: LiveMemory = useMemo(
    () => ({
      armed,
      playing,
      mode,
      paletteId,
      trackNames: [tracks[0].name, tracks[1].name, tracks[2].name],
      spectrumSource,
    }),
    [armed, playing, mode, paletteId, tracks, spectrumSource],
  )

  const note = useCallback((action: string, detail?: string) => {
    setHistory(pushHistory(action, detail))
  }, [])

  const stopAnalyser = useCallback(() => {
    try {
      audioRef.current?.pause()
      if (audioRef.current) {
        audioRef.current.src = ''
        audioRef.current = null
      }
      analyserRef.current = null
      freqDataRef.current = null
      void audioCtxRef.current?.close()
      audioCtxRef.current = null
    } catch {
      /* ignore */
    }
  }, [])

  const tryWireAnalyser = useCallback(
    async (track: TrackState) => {
      stopAnalyser()
      if (!caps.audio || !track.objectUrl) {
        setSpectrumSource('sim')
        return
      }
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AC()
        const audio = new Audio(track.objectUrl)
        audio.loop = true
        audio.crossOrigin = 'anonymous'
        const src = ctx.createMediaElementSource(audio)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 128
        src.connect(analyser)
        analyser.connect(ctx.destination)
        await audio.play()
        audioRef.current = audio
        audioCtxRef.current = ctx
        analyserRef.current = analyser
        freqDataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
        setSpectrumSource(track.slot)
        note('analyser', `track ${track.slot} · ${track.name}`)
      } catch {
        stopAnalyser()
        setSpectrumSource('sim')
        note('analyser-fallback', 'sim spectrum (AudioContext/play blocked)')
      }
    },
    [caps.audio, note, stopAnalyser],
  )

  useEffect(() => () => stopAnalyser(), [stopAnalyser])

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

    const drawBars = (w: number, h: number, bars: Float32Array, liveViz: boolean, c0: string) => {
      const n = bars.length
      const gap = 2
      const barW = Math.max(2, (w - 64 - gap * n) / n)
      const baseY = h * 0.78
      const maxH = h * 0.55
      for (let i = 0; i < n; i++) {
        const bh = bars[i] * maxH * (liveViz ? 1 : 0.45)
        const x = 32 + i * (barW + gap)
        const alpha = liveViz ? 0.85 : 0.35
        ctx.fillStyle = rgba(c0, alpha)
        ctx.fillRect(x, baseY - bh, barW, bh)
        ctx.fillStyle = rgba(c0, alpha * 0.25)
        ctx.fillRect(x, baseY - bh - 3, barW, 2)
      }
      ctx.strokeStyle = rgba(c0, 0.2)
      ctx.beginPath()
      ctx.moveTo(24, baseY + 4)
      ctx.lineTo(w - 24, baseY + 4)
      ctx.stroke()
    }

    const drawRing = (
      w: number,
      h: number,
      bars: Float32Array,
      t: number,
      liveViz: boolean,
      c0: string,
      c1: string,
    ) => {
      const cx = w * 0.5
      const cy = h * 0.48
      const energy = bars.reduce((a, b) => a + b, 0) / bars.length
      const rings = 6
      for (let i = 0; i < rings; i++) {
        const pulse = liveViz ? Math.sin(t * 1.8 + i * 0.7) * 6 * energy : 0
        const r = 28 + i * 26 + pulse + energy * 18
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        const a = liveViz ? 0.55 - i * 0.06 : 0.18
        ctx.strokeStyle = rgba(i % 2 ? c1 : c0, Math.max(0.08, a))
        ctx.lineWidth = i === 0 ? 2.4 : 1.1
        ctx.stroke()
      }
      const spokes = 48
      for (let i = 0; i < spokes; i++) {
        const v = bars[Math.floor((i / spokes) * bars.length)]
        const ang = (i / spokes) * Math.PI * 2 - Math.PI / 2
        const inner = 36
        const outer = inner + v * (liveViz ? 90 : 28)
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner)
        ctx.lineTo(cx + Math.cos(ang) * outer, cy + Math.sin(ang) * outer)
        ctx.strokeStyle = rgba(c0, liveViz ? 0.7 : 0.25)
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }

    const drawWave = (
      w: number,
      h: number,
      bars: Float32Array,
      t: number,
      liveViz: boolean,
      c0: string,
    ) => {
      const mid = h * 0.5
      const amp = liveViz ? h * 0.28 : h * 0.08
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
      ctx.strokeStyle = liveViz ? c0 : rgba(c0, 0.35)
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.beginPath()
      for (let x = 0; x <= w; x += 4) {
        const i = Math.floor((x / w) * (bars.length - 1))
        const v = bars[i]
        const y = mid + Math.sin(x * 0.018 + t * 2.4 + 0.6) * amp * 0.55 * (0.35 + v)
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(c0, 0.25)
      ctx.lineWidth = 1
      ctx.stroke()
    }

    const drawBloom = (
      w: number,
      h: number,
      bars: Float32Array,
      t: number,
      liveViz: boolean,
      c0: string,
      c1: string,
    ) => {
      const cx = w * 0.5
      const cy = h * 0.48
      const energy = bars.reduce((a, b) => a + b, 0) / bars.length
      const petals = 16
      for (let i = 0; i < petals; i++) {
        const ang = (i / petals) * Math.PI * 2 + t * 0.35
        const v = bars[Math.floor((i / petals) * bars.length)]
        const reach = (liveViz ? 70 : 28) + v * (liveViz ? 140 : 40) + energy * 40
        const px = cx + Math.cos(ang) * reach
        const py = cy + Math.sin(ang) * reach
        const grd = ctx.createRadialGradient(cx, cy, 8, px, py, reach)
        const col = i % 2 ? c1 : c0
        grd.addColorStop(0, rgba(col, liveViz ? 0.45 : 0.12))
        grd.addColorStop(0.55, rgba(col, liveViz ? 0.12 : 0.04))
        grd.addColorStop(1, 'transparent')
        ctx.fillStyle = grd
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, reach, ang - 0.22, ang + 0.22)
        ctx.closePath()
        ctx.fill()
      }
      const core = ctx.createRadialGradient(cx, cy, 4, cx, cy, 48 + energy * 30)
      core.addColorStop(0, `rgba(255,255,255,${liveViz ? 0.35 : 0.1})`)
      core.addColorStop(0.4, rgba(c0, liveViz ? 0.5 : 0.15))
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
      const liveViz = isArmed && isPlaying
      const tpl = templateById(paletteRef.current)
      const c0 = tpl.colors[0]
      const c1 = tpl.colors[1]

      ctx.fillStyle = '#050505'
      ctx.fillRect(0, 0, w, h)

      ctx.strokeStyle = rgba(c0, 0.04)
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
      const analyser = analyserRef.current
      const freq = freqDataRef.current
      const useReal = spectrumRef.current !== 'sim' && analyser && freq && liveViz

      if (useReal && analyser && freq) {
        analyser.getByteFrequencyData(freq as Uint8Array<ArrayBuffer>)
        const step = Math.max(1, Math.floor(freq.length / bars.length))
        for (let i = 0; i < bars.length; i++) {
          let sum = 0
          for (let j = 0; j < step; j++) sum += freq[i * step + j] ?? 0
          const target = (sum / step / 255) * 0.95 + 0.04
          bars[i] += (target - bars[i]) * 0.28
        }
      } else {
        for (let i = 0; i < bars.length; i++) {
          let target: number
          if (!isArmed) {
            target = 0.06 + 0.04 * Math.abs(Math.sin(t * 0.4 + i * 0.12))
          } else if (!isPlaying) {
            target = bars[i] * 0.88
          } else {
            target =
              0.12 +
              0.55 *
                Math.abs(Math.sin(t * 2.1 + i * 0.28)) *
                (0.55 + 0.45 * Math.abs(Math.sin(t * 0.7 + i * 0.05)))
          }
          bars[i] += (target - bars[i]) * (liveViz ? 0.22 : 0.08)
        }
      }

      if (m === 'bars') drawBars(w, h, bars, liveViz, c0)
      else if (m === 'ring') drawRing(w, h, bars, t, liveViz, c0, c1)
      else if (m === 'wave') drawWave(w, h, bars, t, liveViz, c0)
      else drawBloom(w, h, bars, t, liveViz, c0, c1)

      ctx.font = '11px ui-monospace, monospace'
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(16, 16, 148, 20)
      ctx.strokeStyle = rgba(c0, 0.4)
      ctx.strokeRect(16, 16, 148, 20)
      ctx.fillStyle = c0
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
    note('arm-stage')
  }

  const onMode = (m: Mode) => {
    setMode(m)
    note('mode', m)
  }

  const onPalette = (id: string) => {
    setPaletteId(id)
    note('palette', templateById(id).name)
  }

  const onTrackFile = (slot: TrackSlot, file: File | null) => {
    setTracks((prev) => {
      const next = applyFile(prev, slot, file)
      note(file ? 'track-load' : 'track-clear', `${slot}${file ? ` · ${file.name}` : ''}`)
      const candidate = firstAnalyserCandidate(next)
      if (candidate && caps.audio) {
        void tryWireAnalyser(candidate)
      } else {
        stopAnalyser()
        setSpectrumSource('sim')
      }
      return next
    })
  }

  const savePreset = () => {
    const name = presetName.trim() || `Preset ${presets.length + 1}`
    const snap = defaultLive()
    Object.assign(snap, {
      armed,
      mode,
      paletteId,
      trackNames: live.trackNames,
      spectrumSource,
    })
    const p: MemoryPreset = {
      id: `p-${Date.now()}`,
      name,
      savedAt: Date.now(),
      snapshot: {
        armed,
        mode,
        paletteId,
        trackNames: live.trackNames,
        spectrumSource,
      },
    }
    const next = [p, ...presets].slice(0, 20)
    setPresets(next)
    savePresets(next)
    setPresetName('')
    note('memory-save', name)
  }

  const loadPreset = (p: MemoryPreset) => {
    setArmed(p.snapshot.armed)
    setPlaying(true)
    setMode(p.snapshot.mode)
    setPaletteId(p.snapshot.paletteId)
    setSpectrumSource(p.snapshot.spectrumSource === 'sim' ? 'sim' : 'sim')
    note('memory-load', p.name)
  }

  const deletePreset = (id: string) => {
    const next = presets.filter((p) => p.id !== id)
    setPresets(next)
    savePresets(next)
    note('memory-delete', id)
  }

  const onCapture = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setCapturing(true)
    setCaptureMsg(null)
    note('capture-start')
    try {
      const result = await captureCanvasBlob(canvas, 2800)
      if (!result) {
        setCaptureMsg('Capture unavailable — MediaRecorder/canvas.captureStream not supported here.')
        note('capture-fail', 'unsupported')
        return
      }
      const ext = extForMime(result.mime)
      triggerDownload(result.blob, `aura-capture-${Date.now()}.${ext}`)
      setCaptureMsg(`Downloaded · ${ext} · ${result.mime} · ~2.8s clip (browser best-effort)`)
      note('capture-ok', ext)
    } finally {
      setCapturing(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-void">
      <header className="border-b border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase" style={{ color: ACCENT }}>
            TrinityWayve · Module
          </p>
          <h1 className="text-xl font-bold tracking-tight">Aura</h1>
          <p className="text-xs text-white/50 mt-0.5">Lab visualizer · color · memory · tracks</p>
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
              onClick={() => {
                setPlaying((p) => !p)
                note(playing ? 'pause' : 'play')
              }}
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
              onClick={() => onMode(m)}
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

      {/* Color bank — magnifier */}
      <section className="border-b border-border px-4 py-3" aria-label="Color bank">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
          <h2 className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/45">
            Color bank · 2026 looks
          </h2>
          <p className="font-mono text-[10px] text-white/35">
            Active: <span style={{ color: palette.colors[0] }}>{palette.name}</span>
            <span className="text-white/20 mx-1">·</span>
            hover/focus magnifies · click applies
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {COLOR_BANK.map((tpl) => {
            const active = paletteId === tpl.id
            const mag = magId === tpl.id
            return (
              <button
                key={tpl.id}
                type="button"
                title={`${tpl.name} — ${tpl.note}`}
                aria-pressed={active}
                onClick={() => onPalette(tpl.id)}
                onMouseEnter={() => setMagId(tpl.id)}
                onMouseLeave={() => setMagId(null)}
                onFocus={() => setMagId(tpl.id)}
                onBlur={() => setMagId(null)}
                className="color-chip group rounded border px-2 py-1.5 text-left transition-transform duration-150 origin-bottom"
                style={{
                  borderColor: active ? tpl.colors[0] : '#1a1a1a',
                  background: active ? 'rgba(168,85,247,0.1)' : 'rgba(0,0,0,0.4)',
                  transform: mag ? 'scale(1.18)' : 'scale(1)',
                  zIndex: mag ? 5 : 1,
                  boxShadow: mag ? `0 8px 24px rgba(0,0,0,0.55), 0 0 0 1px ${tpl.colors[0]}55` : undefined,
                }}
              >
                <div className="flex gap-1 mb-1">
                  {tpl.colors.map((c) => (
                    <span
                      key={c}
                      className="inline-block rounded-sm border border-white/10"
                      style={{
                        width: mag ? 14 : 10,
                        height: mag ? 14 : 10,
                        background: c,
                        transition: 'width 150ms, height 150ms',
                      }}
                    />
                  ))}
                </div>
                <div
                  className="font-mono text-[10px] leading-tight"
                  style={{ color: active ? tpl.colors[0] : 'rgba(255,255,255,0.7)' }}
                >
                  {tpl.name}
                </div>
                <div className="font-mono text-[9px] text-white/30 mt-0.5">{tpl.tag}</div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Tracks A/B/C */}
      <section className="border-b border-border px-4 py-3" aria-label="Upload track channels">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
          <h2 className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/45">
            Upload tracks · A / B / C
          </h2>
          <p className="font-mono text-[10px] text-white/35">
            Spectrum source:{' '}
            <span style={{ color: ACCENT }}>
              {spectrumSource === 'sim' ? 'simulated' : `track ${spectrumSource}`}
            </span>
            {spectrumSource === 'sim' && (
              <span className="text-white/25"> · load audio to wire analyser when AudioContext ok</span>
            )}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {tracks.map((tr) => (
            <label
              key={tr.slot}
              className="rounded border border-border bg-black/50 px-3 py-2 cursor-pointer hover:border-white/20 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-mono text-[11px]" style={{ color: ACCENT }}>
                  Track {tr.slot}
                </span>
                <span className="font-mono text-[9px] text-white/30 uppercase">{tr.kind}</span>
              </div>
              <div className="font-mono text-[11px] text-white/70 truncate" title={tr.name || 'empty'}>
                {tr.name || '— empty —'}
              </div>
              <input
                type="file"
                accept="audio/*,video/*,.mp3,.wav,.flac,.ogg,.m4a,.mp4,.webm,.mov"
                className="mt-2 block w-full text-[10px] text-white/40 file:mr-2 file:rounded file:border file:border-border file:bg-white/5 file:px-2 file:py-0.5 file:text-[10px] file:text-white/70"
                onChange={(e) => onTrackFile(tr.slot, e.target.files?.[0] ?? null)}
              />
              {tr.name && (
                <button
                  type="button"
                  className="mt-1 font-mono text-[9px] text-white/35 hover:text-white/60"
                  onClick={(e) => {
                    e.preventDefault()
                    onTrackFile(tr.slot, null)
                  }}
                >
                  Clear
                </button>
              )}
            </label>
          ))}
        </div>
      </section>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <main className="flex-1 relative min-h-[280px] lg:min-h-[360px]">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
          <div className="absolute right-4 bottom-4 rounded-md border border-border bg-black/70 px-3 py-2 font-mono text-[11px] text-white/60 backdrop-blur max-w-xs">
            <div>
              Mode: <span style={{ color: palette.colors[0] }}>{mode}</span>
              <span className="text-white/25 mx-1.5">·</span>
              {armed ? (playing ? 'live' : 'paused') : 'idle'}
            </div>
            <div className="text-white/35 mt-1">
              {spectrumSource === 'sim'
                ? 'Simulated spectrum — no mic required'
                : `Live analyser · track ${spectrumSource}`}
            </div>
            <div className="text-white/30 mt-0.5 truncate">Palette · {palette.name}</div>
          </div>
        </main>

        {/* Side panels: memory ×3 + download */}
        <aside className="w-full lg:w-[320px] border-t lg:border-t-0 lg:border-l border-border bg-panel/80 overflow-y-auto max-h-[50vh] lg:max-h-none">
          {/* Live memory */}
          <div className="border-b border-border px-3 py-2.5">
            <h3 className="font-mono text-[10px] tracking-[0.18em] uppercase text-white/45 mb-1.5">
              Live memory
            </h3>
            <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
              <span className="chip">{armed ? 'armed' : 'idle'}</span>
              <span className="chip">{playing ? 'playing' : 'paused'}</span>
              <span className="chip">{mode}</span>
              <span className="chip" style={{ borderColor: palette.colors[0], color: palette.colors[0] }}>
                {palette.name}
              </span>
              <span className="chip">src {spectrumSource}</span>
            </div>
            <div className="mt-1.5 font-mono text-[9px] text-white/30 space-y-0.5">
              {(['A', 'B', 'C'] as const).map((s, i) => (
                <div key={s}>
                  {s}: {tracks[i].name || '—'}
                </div>
              ))}
            </div>
          </div>

          {/* Memory presets */}
          <div className="border-b border-border px-3 py-2.5">
            <h3 className="font-mono text-[10px] tracking-[0.18em] uppercase text-white/45 mb-1.5">
              Memory · presets
            </h3>
            <div className="flex gap-1.5 mb-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name"
                className="flex-1 rounded border border-border bg-black/50 px-2 py-1 font-mono text-[11px] text-white/80 outline-none focus:border-white/25"
              />
              <button
                type="button"
                onClick={savePreset}
                className="rounded border px-2 py-1 font-mono text-[10px] uppercase"
                style={{ borderColor: ACCENT, color: ACCENT }}
              >
                Save
              </button>
            </div>
            <ul className="space-y-1 max-h-28 overflow-y-auto">
              {presets.length === 0 && (
                <li className="font-mono text-[10px] text-white/30">No saved presets</li>
              )}
              {presets.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded border border-border/80 px-2 py-1 font-mono text-[10px]"
                >
                  <button type="button" className="text-left text-white/70 hover:text-white truncate" onClick={() => loadPreset(p)}>
                    {p.name}
                  </button>
                  <button type="button" className="text-white/25 hover:text-white/50 shrink-0" onClick={() => deletePreset(p.id)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* History memory */}
          <div className="border-b border-border px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="font-mono text-[10px] tracking-[0.18em] uppercase text-white/45">
                History memory
              </h3>
              <button
                type="button"
                className="font-mono text-[9px] text-white/30 hover:text-white/55"
                onClick={() => {
                  setHistory(clearHistory())
                  note('history-clear')
                }}
              >
                Clear
              </button>
            </div>
            <ul className="space-y-0.5 max-h-32 overflow-y-auto font-mono text-[9px] text-white/40">
              {history.length === 0 && <li>Empty ring</li>}
              {history.slice(0, 12).map((h) => (
                <li key={h.id}>
                  <span className="text-white/25">{fmtTime(h.at)}</span>{' '}
                  <span style={{ color: ACCENT }}>{h.action}</span>
                  {h.detail ? <span className="text-white/30"> · {h.detail}</span> : null}
                </li>
              ))}
            </ul>
          </div>

          {/* Download add-on */}
          <div className="px-3 py-2.5">
            <h3 className="font-mono text-[10px] tracking-[0.18em] uppercase text-white/45 mb-1.5">
              Download add-on
            </h3>
            <p className="font-mono text-[10px] text-white/55 mb-2">Target · {DOWNLOAD_PROFILE.label}</p>
            <div className="flex flex-wrap gap-1.5 mb-2 font-mono text-[9px]">
              <span className="chip">4K60 target</span>
              <span className="chip">44.1–48 kHz</span>
              <span className="chip">320 kbps</span>
              <span className="chip" title="Desktop add-on path — not connected in browser">
                ASIO · desktop path
              </span>
              <span className="chip">mp4 / webm</span>
              <span className="chip" style={{ borderColor: '#14B8A6', color: '#14B8A6' }}>
                528 Hz in bank
              </span>
            </div>
            <p className="font-mono text-[9px] text-white/30 mb-2 leading-relaxed">
              ASIO is a desktop add-on capability chip — not fake connected hardware. Browser: best-effort
              MediaRecorder + canvas.captureStream → webm/mp4 blob when supported.
            </p>
            <div className="font-mono text-[9px] text-white/35 mb-2">
              Capture:{' '}
              {captureCaps.canvasCapture && captureCaps.mediaRecorder
                ? `ok · ${captureCaps.preferredMime ?? 'mime?'}`
                : 'limited / unavailable'}
            </div>
            <button
              type="button"
              disabled={capturing || !captureCaps.mediaRecorder || !captureCaps.canvasCapture}
              onClick={() => void onCapture()}
              className="w-full rounded border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider disabled:opacity-40"
              style={{ borderColor: ACCENT, color: ACCENT, background: 'rgba(168,85,247,0.1)' }}
            >
              {capturing ? 'Capturing…' : 'Capture canvas → download'}
            </button>
            {captureMsg && (
              <p className="mt-1.5 font-mono text-[9px] text-white/45 leading-relaxed">{captureMsg}</p>
            )}
          </div>
        </aside>
      </div>

      <footer className="border-t border-border px-4 py-2 font-mono text-[9px] tracking-wide text-white/35 overflow-x-auto whitespace-nowrap">
        {FOOTER} | DEMO SHELL
      </footer>
    </div>
  )
}
