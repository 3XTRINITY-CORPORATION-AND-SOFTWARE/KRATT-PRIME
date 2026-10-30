/** Curated 2026-class NLE/color looks — original names only (no trademarked LUT/UI clones). */

export type ColorTemplate = {
  id: string
  name: string
  tag: string
  colors: [string, string, string, string]
  note: string
}

export const COLOR_BANK: ColorTemplate[] = [
  {
    id: 'void-violet',
    name: 'Void Violet',
    tag: 'Aura default',
    colors: ['#A855F7', '#7C3AED', '#C084FC', '#050505'],
    note: 'Module accent lock · industrial purple on void',
  },
  {
    id: 'cinema-split',
    name: 'Cinema Split',
    tag: '2026 grade',
    colors: ['#0E7490', '#F97316', '#E2E8F0', '#0B1220'],
    note: 'Teal–amber split inspired by flagship cinematic grades',
  },
  {
    id: 'nordic-ice',
    name: 'Nordic Ice',
    tag: 'cool grade',
    colors: ['#94A3B8', '#38BDF8', '#E0F2FE', '#0F172A'],
    note: 'Desaturated cool highlight · slate low',
  },
  {
    id: 'ember-film',
    name: 'Ember Film',
    tag: 'warm film',
    colors: ['#C45C4A', '#78350F', '#F5D0C5', '#111210'],
    note: 'Warm mid-push · film-adjacent density',
  },
  {
    id: 'matrix-signal',
    name: 'Matrix Signal',
    tag: 'lab cue',
    colors: ['#00FF41', '#166534', '#A7F3D0', '#050505'],
    note: 'STEEL matrix green as signal accent',
  },
  {
    id: 'soft-pastel-lab',
    name: 'Soft Pastel Lab',
    tag: 'editorial',
    colors: ['#F9A8D4', '#A5B4FC', '#FDE68A', '#1E1B2E'],
    note: 'Muted pastels for editorial / social grades',
  },
  {
    id: 'mono-steel',
    name: 'Mono Steel',
    tag: 'neutral',
    colors: ['#A1A1AA', '#52525B', '#E4E4E7', '#09090B'],
    note: 'Neutral steel ladder · no cast',
  },
  {
    id: 'ref-528',
    name: '528 Hz',
    tag: '528inc',
    colors: ['#14B8A6', '#FBBF24', '#5EEAD4', '#042F2E'],
    note: 'Solfeggio-style lab cue · 528 Hz reference tone/preset',
  },
  {
    id: 'bloom-magenta',
    name: 'Bloom Magenta',
    tag: 'bloom mode',
    colors: ['#E879F9', '#DB2777', '#FCE7F3', '#1A0A14'],
    note: 'High-key magenta bloom for petal modes',
  },
  {
    id: 'deep-resolve',
    name: 'Deep Resolve',
    tag: '2026 look',
    colors: ['#6366F1', '#22D3EE', '#F8FAFC', '#020617'],
    note: 'Resolve-*class* cool contrast · original name only',
  },
]

export function templateById(id: string): ColorTemplate {
  return COLOR_BANK.find((t) => t.id === id) ?? COLOR_BANK[0]
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}
