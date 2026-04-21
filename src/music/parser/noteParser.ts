import { createEmptyScore } from '../model/createEmptyScore'
import type { Measure, NoteEvent, ParseResult, Score } from '../model/types'
import { isDurationSymbol, sumMeasureUnits } from '../theory/duration'
import { parseScientificPitch } from '../theory/pitch'
import { createParseError, tokenize } from './shared'

const NOTE_TOKEN_PATTERN = /\||,|[A-Ga-g](?:#|b)?\d+|w|h|q|8|\S+/g
const MAX_MEASURE_UNITS = 8

export function parseNoteInput(input: string): ParseResult<Score> {
  const score = createEmptyScore('notes')
  const errors = []
  const warnings: string[] = []
  const tokens = tokenize(input, NOTE_TOKEN_PATTERN)

  if (tokens.length === 0) {
    errors.push(createParseError(input, 0, 'Enter at least one note event.'))
    return { ok: false, value: score, errors, warnings }
  }

  let currentMeasureEvents: NoteEvent[] = []
  let measureIndex = 0
  let eventIndex = 0

  const pushMeasure = () => {
    if (currentMeasureEvents.length === 0) {
      return
    }

    const measure: Measure = {
      index: measureIndex,
      events: currentMeasureEvents,
    }

    score.measures.push(measure)
    measureIndex += 1
    currentMeasureEvents = []
  }

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex]
    if (!token) {
      continue
    }

    if (token.value === ',') {
      continue
    }

    if (token.value === '|') {
      pushMeasure()
      continue
    }

    if (isDurationSymbol(token.value)) {
      errors.push(createParseError(input, token.index, 'Duration token must follow a note.', token.value))
      continue
    }

    const pitch = parseScientificPitch(token.value)
    if (!pitch) {
      errors.push(
        createParseError(
          input,
          token.index,
          'Expected a note like C4, F#3, or Bb5 in notes mode.',
          token.value,
        ),
      )
      continue
    }

    let duration: NoteEvent['duration'] = 'q'
    const maybeDuration = tokens[tokenIndex + 1]
    if (maybeDuration && isDurationSymbol(maybeDuration.value)) {
      duration = maybeDuration.value
      tokenIndex += 1
    }

    currentMeasureEvents.push({
      id: `m${measureIndex + 1}-n${eventIndex + 1}`,
      kind: 'note',
      pitch,
      duration,
    })
    eventIndex += 1

    const totalUnits = sumMeasureUnits(currentMeasureEvents.map((event) => event.duration))
    if (totalUnits > MAX_MEASURE_UNITS) {
      errors.push(
        createParseError(
          input,
          token.index,
          'Measure exceeds 4/4. Add a bar line or shorten durations.',
          token.value,
        ),
      )
    }
  }

  pushMeasure()

  if (score.measures.length === 0) {
    errors.push(createParseError(input, 0, 'No valid note events were found.'))
  }

  const incompleteMeasureCount = score.measures.filter(
    (measure) => sumMeasureUnits(measure.events.map((event) => event.duration)) < MAX_MEASURE_UNITS,
  ).length

  if (incompleteMeasureCount > 0) {
    warnings.push(
      `${incompleteMeasureCount} measure(s) are rhythmically incomplete and will be padded with rests in MusicXML.`,
    )
  }

  score.metadata.totalEvents = score.measures.reduce((sum, measure) => sum + measure.events.length, 0)

  return {
    ok: errors.length === 0,
    value: score,
    errors,
    warnings,
  }
}
