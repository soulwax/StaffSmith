export type InputMode = 'notes' | 'chords'

export type DurationSymbol = 'w' | 'h' | 'q' | '8' | '16' | '32'

export type MusicXmlNoteType = 'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd'

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
  slurStart?: boolean
  slurStop?: boolean
}

export interface RestEvent {
  id: string
  kind: 'rest'
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

export type DirectionKind = 'dynamic' | 'expression' | 'hairpin'

export interface DirectionEvent {
  id: string
  kind: 'direction'
  directionKind: DirectionKind
  text: string
  value?: 'crescendo' | 'diminuendo'
}

export type RhythmEvent = NoteEvent | RestEvent | ChordEvent

export type ScoreEvent = RhythmEvent | DirectionEvent

export function isRhythmicEvent(event: ScoreEvent): event is RhythmEvent {
  return event.kind === 'note' || event.kind === 'rest' || event.kind === 'chord'
}

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
