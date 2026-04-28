import { describe, expect, it } from 'vitest'
import { getScoreInsights } from '../src/music/analysis/scoreInsights'
import { parseScoreInput } from '../src/music/parser'

describe('score insights', () => {
  it('summarizes note range, duration frequency, and density for the header and inspector', () => {
    const result = parseScoreInput('notes', 'C4 q E4 q G4 h | A4 q B4 q C5 h')
    expect(result.ok).toBe(true)

    expect(getScoreInsights(result.value)).toMatchObject({
      measureCount: 2,
      eventCount: 6,
      noteCount: 6,
      chordCount: 0,
      pitchRange: 'C4-C5',
      topDurations: 'q:4 h:2',
      chordPalette: 'No chords',
      density: '3 events/measure',
    })
  })

  it('returns stable empty-state copy when no score is available', () => {
    expect(getScoreInsights(null)).toMatchObject({
      measureCount: 0,
      pitchRange: 'No score',
      topDurations: 'No durations',
      chordPalette: 'No chords',
      density: '0 events/measure',
    })
  })
})
