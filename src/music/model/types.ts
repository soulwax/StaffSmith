export type InputMode = 'notes' | 'chords'

export type DurationSymbol = 'w' | 'h' | 'q' | '8'

export type MusicXmlNoteType = 'whole' | 'half' | 'quarter' | 'eighth'

export type HarmonyKind =
  | 'major'
  | 'minor'
  | 'major-seventh'
  | 'minor-seventh'
  | 'dominant'
  | 'diminished'
  | 'augmented'
  | 'suspended-second'
  | 'suspended-fourth'

export interface NotePitch {
  step: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  alter: -1 | 0 | 1
  octave: number
  scientific: string
}

export interface NoteEvent {
  id: string
  kind: 'note'
  pitch: NotePitch
  duration: DurationSymbol
}

export interface ChordEvent {
  id: string
  kind: 'chord'
  symbol: string
  duration: DurationSymbol
  root: NotePitch
  helperPitch: NotePitch
  harmonyKind: HarmonyKind
  tones: string[]
}

export type ScoreEvent = NoteEvent | ChordEvent

export interface Measure {
  index: number
  events: ScoreEvent[]
}

export interface Score {
  metadata: {
    title: string
    mode: InputMode
    divisions: number
    beats: number
    beatType: number
    totalEvents: number
  }
  measures: Measure[]
}

export interface ParseError {
  message: string
  index: number
  line: number
  column: number
  token?: string
}

export interface ParseResult<T> {
  ok: boolean
  value: T
  errors: ParseError[]
  warnings: string[]
}
