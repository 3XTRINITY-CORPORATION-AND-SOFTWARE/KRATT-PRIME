export type Mode = 'bars' | 'ring' | 'wave' | 'bloom'

export const MODES: Mode[] = ['bars', 'ring', 'wave', 'bloom']

export type TrackSlot = 'A' | 'B' | 'C'

export type TrackState = {
  slot: TrackSlot
  name: string
  kind: 'empty' | 'audio' | 'video' | 'other'
  objectUrl?: string
}

export const DOWNLOAD_PROFILE = {
  label: 'max 4K60 · 44.1–48 kHz · 320 kbps · ASIO · mp4',
  maxRes: '4K60',
  sampleRate: '44.1–48 kHz',
  bitrate: '320 kbps',
  asio: 'desktop add-on path (not connected in browser)',
  container: 'mp4 / webm (browser best-effort)',
} as const
