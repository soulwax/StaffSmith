import type { ChordEvent, NoteEvent, Score, ScoreEvent } from '../model/types'

export type ScoreInsights = {
  measureCount: number
  eventCount: number
  noteCount: number
  chordCount: number
  pitchRange: string
  topDurations: string
  chordPalette: string
  density: string
}

const STEP_OFFSETS = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
} as const

export function getScoreInsights(score: Score | null): ScoreInsights {
  if (!score) {
    return {
      measureCount: 0,
      eventCount: 0,
      noteCount: 0,
      chordCount: 0,
      pitchRange: 'No score',
      topDurations: 'No durations',
      chordPalette: 'No chords',
      density: '0 events/measure',
    }
  }

  const events = score.measures.flatMap((measure) => measure.events)
  const notes = events.filter(isNoteEvent)
  const chords = events.filter(isChordEvent)
  const durationCounts = new Map<string, number>()

  for (const event of events) {
    durationCounts.set(event.duration, (durationCounts.get(event.duration) ?? 0) + 1)
  }

  return {
    measureCount: score.measures.length,
    eventCount: score.metadata.totalEvents,
    noteCount: notes.length,
    chordCount: chords.length,
    pitchRange: getPitchRange(notes.length > 0 ? notes : chords),
    topDurations: formatCounts(durationCounts),
    chordPalette: chords.length > 0 ? [...new Set(chords.map((chord) => chord.symbol))].slice(0, 6).join(', ') : 'No chords',
    density: `${formatNumber(score.metadata.totalEvents / Math.max(score.measures.length, 1))} events/measure`,
  }
}

function isNoteEvent(event: ScoreEvent): event is NoteEvent {
  return event.kind === 'note'
}

function isChordEvent(event: ScoreEvent): event is ChordEvent {
  return event.kind === 'chord'
}

function getPitchRange(events: Array<NoteEvent | ChordEvent>) {
  if (events.length === 0) {
    return 'No pitches'
  }

  const pitches = events.map((event) => event.kind === 'note' ? event.pitch : event.root)
  const sorted = [...pitches].sort((a, b) => toMidi(a) - toMidi(b))
  const low = sorted[0]
  const high = sorted[sorted.length - 1]

  if (!low || !high) {
    return 'No pitches'
  }

  return `${low.scientific}-${high.scientific}`
}

function toMidi(pitch: NoteEvent['pitch']) {
  return (pitch.octave + 1) * 12 + STEP_OFFSETS[pitch.step] + pitch.alter
}

function formatCounts(counts: Map<string, number>) {
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1])

  if (entries.length === 0) {
    return 'No durations'
  }

  return entries.map(([duration, count]) => `${duration}:${count}`).join(' ')
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
