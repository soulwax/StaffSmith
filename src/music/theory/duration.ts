import type { DurationSymbol, MusicXmlNoteType } from '../model/types'

export const DURATION_UNITS: Record<DurationSymbol, number> = {
  w: 8,
  h: 4,
  q: 2,
  '8': 1,
}

export const MUSICXML_NOTE_TYPE: Record<DurationSymbol, MusicXmlNoteType> = {
  w: 'whole',
  h: 'half',
  q: 'quarter',
  '8': 'eighth',
}

export function isDurationSymbol(value: string): value is DurationSymbol {
  return value === 'w' || value === 'h' || value === 'q' || value === '8'
}

export function sumMeasureUnits(durations: DurationSymbol[]) {
  return durations.reduce((sum, duration) => sum + DURATION_UNITS[duration], 0)
}
