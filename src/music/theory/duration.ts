import type { DurationSymbol, MusicXmlNoteType } from '../model/types'

export const DURATION_UNITS: Record<DurationSymbol, number> = {
  w: 16,
  h: 8,
  q: 4,
  '8': 2,
  '16': 1,
}

export const FULL_MEASURE_UNITS = DURATION_UNITS.w

export const MUSICXML_NOTE_TYPE: Record<DurationSymbol, MusicXmlNoteType> = {
  w: 'whole',
  h: 'half',
  q: 'quarter',
  '8': 'eighth',
  '16': '16th',
}

export function isDurationSymbol(value: string): value is DurationSymbol {
  return value === 'w' || value === 'h' || value === 'q' || value === '8' || value === '16'
}

export function sumMeasureUnits(durations: DurationSymbol[]) {
  return durations.reduce((sum, duration) => sum + DURATION_UNITS[duration], 0)
}
