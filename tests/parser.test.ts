import { describe, expect, it } from 'vitest'
import { isRhythmicEvent } from '../src/music/model/types'
import { parseScoreInput } from '../src/music/parser'

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
    const result = parseScoreInput('notes', 'C4 h R h | rest w | pause q, C4 q, D4 h')

    expect(result.ok).toBe(true)
    expect(result.value.measures).toHaveLength(3)
    expect(result.value.measures[0]?.events[1]).toMatchObject({
      kind: 'rest',
      duration: 'h',
    })
    expect(result.value.measures[1]?.events[0]).toMatchObject({
      kind: 'rest',
      duration: 'w',
    })
    expect(result.value.measures[2]?.events[0]).toMatchObject({
      kind: 'rest',
      duration: 'q',
    })
  })

  it('parses fast durations and slur parentheses for smooth transitions', () => {
    const result = parseScoreInput('notes', '( C4 8, D4 8, E4 q ) pause q, G4 32, A4 32, B4 16, C5 8')

    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.value.measures).toHaveLength(1)
    expect(result.value.measures[0]?.events[0]).toMatchObject({
      kind: 'note',
      duration: '8',
      slurStart: true,
    })
    expect(result.value.measures[0]?.events[2]).toMatchObject({
      kind: 'note',
      duration: 'q',
      slurStop: true,
    })
    expect(result.value.measures[0]?.events[3]).toMatchObject({
      kind: 'rest',
      duration: 'q',
    })
    expect(result.value.measures[0]?.events[4]).toMatchObject({
      kind: 'note',
      duration: '32',
    })
    expect(result.value.measures[0]?.events[5]).toMatchObject({
      kind: 'note',
      duration: '32',
    })
    expect(result.value.measures[0]?.events[6]).toMatchObject({
      kind: 'note',
      duration: '16',
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

  it('parses StaffScript metadata, default duration, sections, motifs, and repeats', () => {
    const result = parseScoreInput(
      'notes',
      '@version=0.1\n@title="Take 5 for the Flute"\n@composer="Konstantin Kling"\n@instrument=flute\n@tempo=120\n@time=5/4\n@key=Dm\n@dur=q\n\n@motif intro = ( D5, F5, A5 h )\n@fall = > G5, F5, E5, D5\n\nsection intro {\n  mp use intro | use fall, R q\n}\n\nx2 {\n  use intro | pause h, D5 h, R q\n}',
    )

    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.value.metadata).toMatchObject({
      sourceFormat: 'staffscript',
      staffScriptVersion: '0.1',
      title: 'Take 5 for the Flute',
      composer: 'Konstantin Kling',
      instrument: 'flute',
      tempoBpm: 120,
      beats: 5,
      beatType: 4,
      key: 'Dm',
      defaultDuration: 'q',
    })
    expect(result.value.measures).toHaveLength(6)
    expect(result.value.measures[0]?.events[0]).toMatchObject({
      kind: 'direction',
      directionKind: 'section',
      text: 'intro',
    })
    expect(result.value.measures[0]?.events[4]).toMatchObject({
      kind: 'note',
      duration: 'h',
    })
  })

  it('reports missing and recursive StaffScript motifs', () => {
    const missing = parseScoreInput('notes', 'use missing')
    expect(missing.ok).toBe(false)
    expect(missing.errors[0]?.message).toContain('Unknown motif "missing"')

    const recursive = parseScoreInput('notes', '@motif loop = use loop\nuse loop')
    expect(recursive.ok).toBe(false)
    expect(recursive.errors[0]?.message).toContain('expands recursively')
  })

  it('accepts the StaffScript v0.1 chord subset', () => {
    const result = parseScoreInput(
      'chords',
      '@mode=chords\nC | Cm | Cmaj7 | Cmin7 | C7 | Cm7 | Cdim | Caug | Csus4 | Cadd9 | F#dim | Bbmaj7',
    )

    expect(result.ok).toBe(true)
    expect(result.value.measures).toHaveLength(12)
  })
})
