export type ClefOption = 'treble' | 'bass' | 'alto' | 'tenor'

export type SheetDensity = 'spacious' | 'standard' | 'compact'

export type ScoreSheetOptions = {
  title: string
  subtitle: string
  composer: string
  staffLabel: string
  clef: ClefOption
  keyFifths: number
  beats: number
  beatType: number
  tempoBpm: number
  showTitle: boolean
  showTempo: boolean
  padIncompleteMeasures: boolean
  density: SheetDensity
}

export const DEFAULT_SHEET_OPTIONS: ScoreSheetOptions = {
  title: 'Untitled sketch',
  subtitle: '',
  composer: '',
  staffLabel: '',
  clef: 'treble',
  keyFifths: 0,
  beats: 4,
  beatType: 4,
  tempoBpm: 96,
  showTitle: true,
  showTempo: true,
  padIncompleteMeasures: true,
  density: 'standard',
}

export const KEY_SIGNATURES = [
  { label: 'Cb / Abm', value: -7 },
  { label: 'Gb / Ebm', value: -6 },
  { label: 'Db / Bbm', value: -5 },
  { label: 'Ab / Fm', value: -4 },
  { label: 'Eb / Cm', value: -3 },
  { label: 'Bb / Gm', value: -2 },
  { label: 'F / Dm', value: -1 },
  { label: 'C / Am', value: 0 },
  { label: 'G / Em', value: 1 },
  { label: 'D / Bm', value: 2 },
  { label: 'A / F#m', value: 3 },
  { label: 'E / C#m', value: 4 },
  { label: 'B / G#m', value: 5 },
  { label: 'F# / D#m', value: 6 },
  { label: 'C# / A#m', value: 7 },
] as const

export const TIME_SIGNATURES = [
  { label: '2/4', beats: 2, beatType: 4 },
  { label: '3/4', beats: 3, beatType: 4 },
  { label: '4/4', beats: 4, beatType: 4 },
  { label: '5/4', beats: 5, beatType: 4 },
  { label: '6/8', beats: 6, beatType: 8 },
] as const

export function getClefDefinition(clef: ClefOption) {
  if (clef === 'bass') {
    return { sign: 'F', line: 4 }
  }

  if (clef === 'alto') {
    return { sign: 'C', line: 3 }
  }

  if (clef === 'tenor') {
    return { sign: 'C', line: 4 }
  }

  return { sign: 'G', line: 2 }
}

export function getDensityScale(density: SheetDensity) {
  if (density === 'compact') {
    return 0.78
  }

  if (density === 'spacious') {
    return 1.12
  }

  return 1
}
