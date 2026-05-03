import type { Score, StaffClef } from '../model/types'

export type ParsedKeySignature = {
  label: string
  fifths: number
}

export type ParsedTimeSignature = Pick<Score['metadata'], 'beats' | 'beatType'>

const MAJOR_KEY_FIFTHS: Record<string, number> = {
  Cb: -7,
  Gb: -6,
  Db: -5,
  Ab: -4,
  Eb: -3,
  Bb: -2,
  F: -1,
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  'F#': 6,
  'C#': 7,
}

const MINOR_KEY_FIFTHS: Record<string, number> = {
  Ab: -7,
  Eb: -6,
  Bb: -5,
  F: -4,
  C: -3,
  G: -2,
  D: -1,
  A: 0,
  E: 1,
  B: 2,
  'F#': 3,
  'C#': 4,
  'G#': 5,
  'D#': 6,
  'A#': 7,
}

const CLEF_ALIASES: Record<string, StaffClef> = {
  treble: 'treble',
  violin: 'treble',
  'violin-clef': 'treble',
  g: 'treble',
  g2: 'treble',
  'g-clef': 'treble',
  'g-clef-2': 'treble',
  bass: 'bass',
  f: 'bass',
  f4: 'bass',
  'f-clef': 'bass',
  'f-clef-4': 'bass',
  alto: 'alto',
  c3: 'alto',
  'c-clef': 'alto',
  'c-clef-3': 'alto',
  tenor: 'tenor',
  c4: 'tenor',
  'c-clef-4': 'tenor',
}

export function parseClef(value: string): StaffClef | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')

  return CLEF_ALIASES[normalized] ?? null
}

export function parseKeySignature(value: string): ParsedKeySignature | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const numericFifths = Number(trimmed)
  if (Number.isInteger(numericFifths) && numericFifths >= -7 && numericFifths <= 7) {
    return {
      label: trimmed,
      fifths: numericFifths,
    }
  }

  const normalized = trimmed
    .replace(/-/g, ' ')
    .replace(/\bflat\b/gi, 'b')
    .replace(/\bsharp\b/gi, '#')
    .replace(/\s+/g, ' ')
    .trim()

  if (/^(none|open|atonal|no key|no signature)$/i.test(normalized)) {
    return {
      label: trimmed,
      fifths: 0,
    }
  }

  const compact = normalized.replace(/\s+/g, '')
  const match = compact.match(/^([A-Ga-g])(#|b)?(major|maj|minor|min|m)?$/i)
  if (!match) {
    return null
  }

  const root = `${match[1]?.toUpperCase() ?? ''}${match[2] ?? ''}`
  const suffix = match[3]?.toLowerCase() ?? ''
  const isMinor = suffix === 'm' || suffix.startsWith('min')
  const fifths = isMinor ? MINOR_KEY_FIFTHS[root] : MAJOR_KEY_FIFTHS[root]

  return typeof fifths === 'number'
    ? {
        label: trimmed,
        fifths,
      }
    : null
}

export function parseTimeSignature(value: string): ParsedTimeSignature | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'common' || normalized === 'c') {
    return { beats: 4, beatType: 4 }
  }

  if (normalized === 'cut' || normalized === 'cut-common' || normalized === 'alla breve' || normalized === 'alla-breve') {
    return { beats: 2, beatType: 2 }
  }

  const time = normalized.match(/^(\d+)\/(\d+)$/)
  const beats = Number.parseInt(time?.[1] ?? '', 10)
  const beatType = Number.parseInt(time?.[2] ?? '', 10)
  const supportedBeatTypes = new Set([1, 2, 4, 8, 16, 32])

  return Number.isInteger(beats)
    && beats > 0
    && beats <= 64
    && Number.isInteger(beatType)
    && supportedBeatTypes.has(beatType)
    ? { beats, beatType }
    : null
}
