import type { DurationSymbol, MusicXmlNoteType } from '../model/types'

export const DURATION_UNITS: Record<DurationSymbol, number> = {
  w: 32,
  h: 16,
  q: 8,
  '8': 4,
  '16': 2,
  '32': 1,
}

export const FULL_MEASURE_UNITS = DURATION_UNITS.w

export const MUSICXML_NOTE_TYPE: Record<DurationSymbol, MusicXmlNoteType> = {
  w: 'whole',
  h: 'half',
  q: 'quarter',
  '8': 'eighth',
  '16': '16th',
  '32': '32nd',
}

export function isDurationSymbol(value: string): value is DurationSymbol {
  return value === 'w' || value === 'h' || value === 'q' || value === '8' || value === '16' || value === '32'
}

export function sumMeasureUnits(durations: DurationSymbol[]) {
  return durations.reduce((sum, duration) => sum + DURATION_UNITS[duration], 0)
}

export function getMeasureCapacityUnits(beats: number, beatType: number) {
  const capacity = FULL_MEASURE_UNITS * (beats / beatType)

  return Number.isFinite(capacity) && capacity > 0 ? capacity : FULL_MEASURE_UNITS
}
