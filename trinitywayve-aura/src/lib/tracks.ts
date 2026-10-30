import type { TrackSlot, TrackState } from './types'

export function emptyTracks(): [TrackState, TrackState, TrackState] {
  return [
    { slot: 'A', name: '', kind: 'empty' },
    { slot: 'B', name: '', kind: 'empty' },
    { slot: 'C', name: '', kind: 'empty' },
  ]
}

export function classifyFile(file: File): TrackState['kind'] {
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus'].includes(ext)) return 'audio'
  if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) return 'video'
  return 'other'
}

export function applyFile(
  tracks: [TrackState, TrackState, TrackState],
  slot: TrackSlot,
  file: File | null,
): [TrackState, TrackState, TrackState] {
  const idx = slot === 'A' ? 0 : slot === 'B' ? 1 : 2
  const prev = tracks[idx]
  if (prev.objectUrl) URL.revokeObjectURL(prev.objectUrl)
  const next = [...tracks] as [TrackState, TrackState, TrackState]
  if (!file) {
    next[idx] = { slot, name: '', kind: 'empty' }
    return next
  }
  next[idx] = {
    slot,
    name: file.name,
    kind: classifyFile(file),
    objectUrl: URL.createObjectURL(file),
  }
  return next
}

export function firstAnalyserCandidate(
  tracks: [TrackState, TrackState, TrackState],
): TrackState | null {
  return tracks.find((t) => t.kind === 'audio' || t.kind === 'video') ?? null
}
