import { createEmptyScore } from '../model/createEmptyScore'
import type { ChordEvent, Measure, ParseResult, Score } from '../model/types'
import { parseChordSymbol, resolveChordDurations } from '../theory/chords'
import { createParseError, tokenize } from './shared'

const CHORD_TOKEN_PATTERN = /\||,|[^\s|,]+/g

export function parseChordInput(input: string): ParseResult<Score> {
  const score = createEmptyScore('chords')
  const errors = []
  const warnings: string[] = []
  const tokens = tokenize(input, CHORD_TOKEN_PATTERN)

  if (tokens.length === 0) {
    errors.push(createParseError(input, 0, 'Enter at least one chord symbol.'))
    return { ok: false, value: score, errors, warnings }
  }

  let currentMeasureTokens: typeof tokens = []
  let measureIndex = 0
  let eventIndex = 0

  const pushMeasure = () => {
    if (currentMeasureTokens.length === 0) {
      return
    }

    const durations = resolveChordDurations(currentMeasureTokens.length)
    if (!durations) {
      const token = currentMeasureTokens[4] ?? currentMeasureTokens[currentMeasureTokens.length - 1]
      if (!token) {
        currentMeasureTokens = []
        return
      }

      errors.push(
        createParseError(
          input,
          token.index,
          'Chord mode currently supports up to four chord symbols per measure.',
          token.value,
        ),
      )
      currentMeasureTokens = []
      return
    }

    const events: ChordEvent[] = []

    currentMeasureTokens.forEach((token, index) => {
      const parsedChord = parseChordSymbol(token.value)
      const duration = durations[index]
      if (!duration) {
        return
      }

      if (!parsedChord) {
        errors.push(
          createParseError(
            input,
            token.index,
            'Unsupported chord symbol. Try forms like C, Cm, Cmaj7, Am7, D7, or Bbmaj7.',
            token.value,
          ),
        )
        return
      }

      events.push({
        id: `m${measureIndex + 1}-c${eventIndex + 1}`,
        kind: 'chord',
        duration,
        ...parsedChord,
      })
      eventIndex += 1
    })

    if (events.length > 0) {
      const measure: Measure = {
        index: measureIndex,
        events,
      }
      score.measures.push(measure)
      measureIndex += 1
    }

    currentMeasureTokens = []
  }

  for (const token of tokens) {
    if (token.value === ',') {
      continue
    }

    if (token.value === '|') {
      pushMeasure()
      continue
    }

    currentMeasureTokens.push(token)
  }

  pushMeasure()

  if (score.measures.length === 0) {
    errors.push(createParseError(input, 0, 'No valid chord events were found.'))
  }

  if (score.measures.some((measure) => measure.events.length > 1)) {
    warnings.push('Chord durations are evenly distributed inside each measure for this MVP.')
  }

  score.metadata.totalEvents = score.measures.reduce((sum, measure) => sum + measure.events.length, 0)

  return {
    ok: errors.length === 0,
    value: score,
    errors,
    warnings,
  }
}
