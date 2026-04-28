import { describe, expect, it } from 'vitest'
import { parseScoreInput } from '../src/music/parser'
import { isRhythmicEvent } from '../src/music/model/types'

describe('StaffSmith parser', () => {
  it('parses compact note notation with dynamics, expression text, and hairpins', () => {
    const result = parseScoreInput(
      'notes',
      'mf [dolce] C4 q, E4 q, G4 h | < A4 q B4 q > C5 h',
    )

    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.value.measures).toHaveLength(2)
    expect(result.value.metadata.totalEvents).toBe(10)

    const firstMeasure = result.value.measures[0]
    const secondMeasure = result.value.measures[1]
    expect(firstMeasure?.events.map((event) => event.kind)).toEqual([
      'direction',
      'direction',
      'note',
      'note',
      'note',
    ])
    expect(secondMeasure?.events[0]).toMatchObject({
      kind: 'direction',
      directionKind: 'hairpin',
      value: 'crescendo',
    })
    expect(secondMeasure?.events[3]).toMatchObject({
      kind: 'direction',
      directionKind: 'hairpin',
      value: 'diminuendo',
    })
  })

  it('flags overfull measures so unprintable rhythms do not silently pass', () => {
    const result = parseScoreInput('notes', 'C4 h E4 h G4 q')

    expect(result.ok).toBe(false)
    expect(result.errors[0]?.message).toContain('Measure exceeds 4/4')
  })

  it('parses explicit note-mode rests with durations', () => {
    const result = parseScoreInput('notes', 'C4 h R h | rest w')

    expect(result.ok).toBe(true)
    expect(result.value.measures).toHaveLength(2)
    expect(result.value.measures[0]?.events[1]).toMatchObject({
      kind: 'rest',
      duration: 'h',
    })
    expect(result.value.measures[1]?.events[0]).toMatchObject({
      kind: 'rest',
      duration: 'w',
    })
  })

  it('parses lead-sheet chords and distributes durations inside measures', () => {
    const result = parseScoreInput('chords', 'mf Cmaj7 Am7 | Dm7 G7 Cmaj7')

    expect(result.ok).toBe(true)
    expect(result.value.measures).toHaveLength(2)
    expect(result.warnings).toContain('Chord durations are evenly distributed inside each measure for this MVP.')

    const firstMeasureChords = result.value.measures[0]?.events.filter(isRhythmicEvent)
    const secondMeasureChords = result.value.measures[1]?.events.filter(isRhythmicEvent)

    expect(firstMeasureChords?.map((event) => event.duration)).toEqual(['h', 'h'])
    expect(secondMeasureChords?.map((event) => event.duration)).toEqual(['q', 'q', 'h'])
    expect(firstMeasureChords?.[0]).toMatchObject({
      kind: 'chord',
      symbol: 'Cmaj7',
      harmonyKind: 'major-seventh',
    })
  })
})
