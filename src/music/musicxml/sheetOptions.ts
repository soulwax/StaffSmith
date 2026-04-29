export type ClefOption = 'treble' | 'bass' | 'alto' | 'tenor'

export type SheetDensity = 'spacious' | 'standard' | 'compact'

export type PageFormat = 'a4' | 'nine-by-twelve'

export type PartLayoutPresetId = 'orchestral-solo' | 'standard-part' | 'children-songs'

type LegacyPartLayoutPresetId = 'orchestra-solo' | 'moderate' | 'children'

export type PartLayoutPreset = {
  id: PartLayoutPresetId
  label: string
  density: SheetDensity
  measuresPerSystem: number
  systemsPerPageTarget: number
  minimumSystemGapMm: number
  insideMarginMm?: number
  outsideMarginMm?: number
  topMarginMm?: number
  bottomMarginMm?: number
  previewNoteScale: number
  previewSystemSpacing: number
}

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
  partLayoutPreset: PartLayoutPresetId
  pageFormat: PageFormat
  measuresPerSystem: number
  systemsPerPageTarget: number
  insideMarginMm: number
  outsideMarginMm: number
  topMarginMm: number
  bottomMarginMm: number
  minimumSystemGapMm: number
}

export const PART_LAYOUT_PRESETS: PartLayoutPreset[] = [
  {
    id: 'orchestral-solo',
    label: 'Orchestral Solo',
    density: 'standard',
    measuresPerSystem: 6,
    systemsPerPageTarget: 12,
    minimumSystemGapMm: 3,
    insideMarginMm: 10,
    outsideMarginMm: 10,
    topMarginMm: 10,
    bottomMarginMm: 10,
    previewNoteScale: 62,
    previewSystemSpacing: 72,
  },
  {
    id: 'standard-part',
    label: 'Standard Part',
    density: 'standard',
    measuresPerSystem: 4,
    systemsPerPageTarget: 9,
    minimumSystemGapMm: 5,
    previewNoteScale: 102,
    previewSystemSpacing: 112,
  },
  {
    id: 'children-songs',
    label: "For Children's Songs",
    density: 'spacious',
    measuresPerSystem: 3,
    systemsPerPageTarget: 8,
    minimumSystemGapMm: 7,
    previewNoteScale: 120,
    previewSystemSpacing: 148,
  },
]

export const DEFAULT_PART_LAYOUT_PRESET: PartLayoutPresetId = 'standard-part'

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
  partLayoutPreset: DEFAULT_PART_LAYOUT_PRESET,
  pageFormat: 'a4',
  measuresPerSystem: 4,
  systemsPerPageTarget: 9,
  insideMarginMm: 15,
  outsideMarginMm: 10,
  topMarginMm: 10,
  bottomMarginMm: 10,
  minimumSystemGapMm: 4,
}

export function normalizePartLayoutPresetId(value: unknown): PartLayoutPresetId {
  if (value === 'orchestra-solo') {
    return 'orchestral-solo'
  }

  if (value === 'moderate') {
    return 'standard-part'
  }

  if (value === 'children') {
    return 'children-songs'
  }

  return PART_LAYOUT_PRESETS.some((preset) => preset.id === value)
    ? value as PartLayoutPresetId
    : DEFAULT_PART_LAYOUT_PRESET
}

export function getPartLayoutPreset(id: PartLayoutPresetId | LegacyPartLayoutPresetId) {
  const normalizedId = normalizePartLayoutPresetId(id)

  return PART_LAYOUT_PRESETS.find((preset) => preset.id === normalizedId) ?? PART_LAYOUT_PRESETS[1]!
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
