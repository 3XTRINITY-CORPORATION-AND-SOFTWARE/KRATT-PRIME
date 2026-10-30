/** Three memory layers: Memory (presets) · Live (session) · History (ring). */

import type { Mode } from './types'

const PRESETS_KEY = 'aura.memory.presets.v1'
const HISTORY_KEY = 'aura.memory.history.v1'
const HISTORY_MAX = 24

export type ModeName = Mode

export type LiveMemory = {
  armed: boolean
  playing: boolean
  mode: ModeName
  paletteId: string
  trackNames: [string, string, string]
  spectrumSource: 'sim' | 'A' | 'B' | 'C'
}

export type MemoryPreset = {
  id: string
  name: string
  savedAt: number
  snapshot: Omit<LiveMemory, 'playing'> & { playing?: boolean }
}

export type HistoryEntry = {
  id: string
  at: number
  action: string
  detail?: string
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function loadPresets(): MemoryPreset[] {
  if (typeof localStorage === 'undefined') return []
  return safeParse(localStorage.getItem(PRESETS_KEY), [])
}

export function savePresets(presets: MemoryPreset[]) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === 'undefined') return []
  return safeParse(localStorage.getItem(HISTORY_KEY), [])
}

export function pushHistory(action: string, detail?: string): HistoryEntry[] {
  const entry: HistoryEntry = {
    id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    action,
    detail,
  }
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  }
  return next
}

export function clearHistory(): HistoryEntry[] {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([]))
  }
  return []
}

export function defaultLive(): LiveMemory {
  return {
    armed: false,
    playing: true,
    mode: 'bars',
    paletteId: 'void-violet',
    trackNames: ['', '', ''],
    spectrumSource: 'sim',
  }
}
