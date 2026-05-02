import { createEmptyScore } from '../model/createEmptyScore'
import {
  isRhythmicEvent,
  type DurationSymbol,
  type Measure,
  type NoteEvent,
  type ParseResult,
  type RestEvent,
  type Score,
} from '../model/types'
import { getMeasureCapacityUnits, isDurationSymbol, sumMeasureUnits } from '../theory/duration'
import { parseScientificPitch } from '../theory/pitch'
import { parseDirectionToken } from './notation'
import { createParseError, tokenize } from './shared'

const NOTE_TOKEN_PATTERN = /\||,|\(|\)|\[[^\]]+\]|[<>]|[A-Ga-g](?:#|b)?\d+|[Rr](?:est)?|pause|w|h|q|8|16|32|\S+/gi

export type NoteParserOptions = {
  defaultDuration?: DurationSymbol
  beats?: number
  beatType?: number
}

export function parseNoteInput(input: string, options: NoteParserOptions = {}): ParseResult<Score> {
  const score = createEmptyScore('notes', options)
  const errors = []
  const warnings: string[] = []
  const tokens = tokenize(input, NOTE_TOKEN_PATTERN)
  const defaultDuration = options.defaultDuration ?? 'q'
  const measureCapacityUnits = getMeasureCapacityUnits(score.metadata.beats, score.metadata.beatType)

  if (tokens.length === 0) {
    errors.push(createParseError(input, 0, 'Enter at least one note event.'))
    return { ok: false, value: score, errors, warnings }
  }

  let currentMeasureEvents: Measure['events'] = []
  let measureIndex = 0
  let eventIndex = 0
  let directionIndex = 0
  let pendingSlurStart = false
  let openSlurs = 0
  let lastNoteEvent: NoteEvent | null = null
  let lastEventCanEndSlur = false

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

    if (token.value === '(') {
      pendingSlurStart = true
      openSlurs += 1
      continue
    }

    if (token.value === ')') {
      if (openSlurs > 0 && lastNoteEvent && lastEventCanEndSlur) {
        lastNoteEvent.slurStop = true
      } else {
        errors.push(createParseError(input, token.index, 'Slur end must follow a note.', token.value))
      }
      if (openSlurs > 0) {
        openSlurs -= 1
      }
      continue
    }

    if (token.value === '|') {
      pushMeasure()
      continue
    }

    const direction = parseDirectionToken(token.value, `m${measureIndex + 1}-d${directionIndex + 1}`)
    if (direction) {
      currentMeasureEvents.push(direction)
      directionIndex += 1
      continue
    }

    if (isDurationSymbol(token.value)) {
      errors.push(createParseError(input, token.index, 'Duration token must follow a note or rest.', token.value))
      continue
    }

    const isRestToken = /^rest$/i.test(token.value) || /^r$/i.test(token.value) || /^pause$/i.test(token.value)
    if (isRestToken) {
      let duration: RestEvent['duration'] = defaultDuration
      const maybeDuration = tokens[tokenIndex + 1]
      if (maybeDuration && isDurationSymbol(maybeDuration.value)) {
        duration = maybeDuration.value
        tokenIndex += 1
      }

      currentMeasureEvents.push({
        id: `m${measureIndex + 1}-r${eventIndex + 1}`,
        kind: 'rest',
        duration,
      })
      eventIndex += 1
      lastEventCanEndSlur = false

      const totalUnits = sumMeasureUnits(currentMeasureEvents.filter(isRhythmicEvent).map((event) => event.duration))
      if (totalUnits > measureCapacityUnits) {
        errors.push(
          createParseError(
            input,
            token.index,
            `Measure exceeds ${score.metadata.beats}/${score.metadata.beatType}. Add a bar line or shorten durations.`,
            token.value,
          ),
        )
      }
      if (pendingSlurStart) {
        errors.push(createParseError(input, token.index, 'Slur start must attach to a note, not a rest or pause.', token.value))
        pendingSlurStart = false
      }
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

    let duration: NoteEvent['duration'] = defaultDuration
    const maybeDuration = tokens[tokenIndex + 1]
    if (maybeDuration && isDurationSymbol(maybeDuration.value)) {
      duration = maybeDuration.value
      tokenIndex += 1
    }

    const noteEvent: NoteEvent = {
      id: `m${measureIndex + 1}-n${eventIndex + 1}`,
      kind: 'note',
      pitch,
      duration,
      ...(pendingSlurStart ? { slurStart: true } : {}),
    }
    currentMeasureEvents.push(noteEvent)
    pendingSlurStart = false
    lastNoteEvent = noteEvent
    lastEventCanEndSlur = true
    eventIndex += 1

    const totalUnits = sumMeasureUnits(currentMeasureEvents.filter(isRhythmicEvent).map((event) => event.duration))
    if (totalUnits > measureCapacityUnits) {
      errors.push(
        createParseError(
          input,
          token.index,
          `Measure exceeds ${score.metadata.beats}/${score.metadata.beatType}. Add a bar line or shorten durations.`,
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
    (measure) => sumMeasureUnits(measure.events.filter(isRhythmicEvent).map((event) => event.duration)) < measureCapacityUnits,
  ).length

  if (pendingSlurStart) {
    errors.push(createParseError(input, input.length, 'Slur start must be followed by a note.', '('))
  }
  if (openSlurs > 0) {
    errors.push(createParseError(input, input.length, 'Slur start must be closed with ).', '('))
  }

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
