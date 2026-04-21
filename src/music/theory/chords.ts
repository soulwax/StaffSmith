import { Chord } from 'tonal'
import type { ChordEvent, DurationSymbol, HarmonyKind } from '../model/types'
import { parseScientificPitch } from './pitch'

type ParsedChord = Pick<ChordEvent, 'symbol' | 'root' | 'helperPitch' | 'harmonyKind' | 'tones'>

const CHORD_DURATION_LOOKUP: Record<number, DurationSymbol[]> = {
  1: ['w'],
  2: ['h', 'h'],
  3: ['q', 'q', 'h'],
  4: ['q', 'q', 'q', 'q'],
}

export function resolveChordDurations(count: number): DurationSymbol[] | null {
  return CHORD_DURATION_LOOKUP[count] ?? null
}

export function parseChordSymbol(symbol: string): ParsedChord | null {
  const parsed = Chord.get(symbol)
  if (parsed.empty || !parsed.tonic) {
    return null
  }

  const root = parseScientificPitch(`${parsed.tonic}4`)
  const helperPitch = parseScientificPitch(`${parsed.tonic}3`)
  if (!root || !helperPitch) {
    return null
  }

  return {
    symbol,
    root,
    helperPitch,
    harmonyKind: inferHarmonyKind(symbol),
    tones: parsed.notes,
  }
}

function inferHarmonyKind(symbol: string): HarmonyKind {
  const normalized = symbol.trim()

  if (/maj7/i.test(normalized)) {
    return 'major-seventh'
  }

  if (/(^|[A-G][#b]?)(m7|min7)/i.test(normalized)) {
    return 'minor-seventh'
  }

  if (/(^|[A-G][#b]?)(m|min)(?!aj)/i.test(normalized)) {
    return 'minor'
  }

  if (/dim/i.test(normalized)) {
    return 'diminished'
  }

  if (/aug/i.test(normalized)) {
    return 'augmented'
  }

  if (/sus2/i.test(normalized)) {
    return 'suspended-second'
  }

  if (/sus4|sus/i.test(normalized)) {
    return 'suspended-fourth'
  }

  if (/7/.test(normalized)) {
    return 'dominant'
  }

  return 'major'
}
