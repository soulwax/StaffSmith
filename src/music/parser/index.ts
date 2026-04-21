import type { InputMode, ParseResult, Score } from '../model/types'
import { parseChordInput } from './chordParser'
import { parseNoteInput } from './noteParser'

export function parseScoreInput(mode: InputMode, input: string): ParseResult<Score> {
  if (mode === 'notes') {
    return parseNoteInput(input)
  }

  return parseChordInput(input)
}
