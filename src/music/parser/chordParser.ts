import { createEmptyScore } from '../model/createEmptyScore'
import type { Measure, ParseResult, Score } from '../model/types'
import { parseChordSymbol, resolveChordDurations } from '../theory/chords'
import { parseDirectionToken } from './notation'
import { createParseError, tokenize } from './shared'

const CHORD_TOKEN_PATTERN = /\||,|\[[^\]]+\]|[<>]|[^\s|,]+/g

type ChordMeasureItem =
  | {
      kind: 'chord-token'
      token: ReturnType<typeof tokenize>[number]
    }
  | {
      kind: 'direction'
      event: Measure['events'][number]
    }

export function parseChordInput(input: string): ParseResult<Score> {
  const score = createEmptyScore('chords')
  const errors = []
  const warnings: string[] = []
  const tokens = tokenize(input, CHORD_TOKEN_PATTERN)

  if (tokens.length === 0) {
    errors.push(createParseError(input, 0, 'Enter at least one chord symbol.'))
    return { ok: false, value: score, errors, warnings }
  }

  let currentMeasureItems: ChordMeasureItem[] = []
  let measureIndex = 0
  let eventIndex = 0
  let directionIndex = 0

  const pushMeasure = () => {
    if (currentMeasureItems.length === 0) {
      return
    }

    const currentMeasureTokens = currentMeasureItems
      .filter((item): item is Extract<ChordMeasureItem, { kind: 'chord-token' }> => item.kind === 'chord-token')
      .map((item) => item.token)

    const durations = resolveChordDurations(currentMeasureTokens.length)
    if (!durations) {
      const token = currentMeasureTokens[4] ?? currentMeasureTokens[currentMeasureTokens.length - 1]
      if (!token) {
        currentMeasureItems = []
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
      currentMeasureItems = []
      return
    }

    const events: Measure['events'] = []
    let chordIndex = 0

    currentMeasureItems.forEach((item) => {
      if (item.kind === 'direction') {
        events.push(item.event)
        return
      }

      const token = item.token
      const parsedChord = parseChordSymbol(token.value)
      const duration = durations[chordIndex]
      chordIndex += 1
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

    currentMeasureItems = []
  }

  for (const token of tokens) {
    if (token.value === ',') {
      continue
    }

    if (token.value === '|') {
      pushMeasure()
      continue
    }

    const direction = parseDirectionToken(token.value, `m${measureIndex + 1}-d${directionIndex + 1}`)
    if (direction) {
      currentMeasureItems.push({ kind: 'direction', event: direction })
      directionIndex += 1
      continue
    }

    currentMeasureItems.push({ kind: 'chord-token', token })
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
