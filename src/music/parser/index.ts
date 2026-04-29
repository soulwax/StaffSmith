import type { InputMode, ParseResult, Score } from '../model/types'
import { parseChordInput } from './chordParser'
import { parseNoteInput } from './noteParser'

const TEMPO_PREFIX_RE = /^@tempo=(\d+)\s*/i

export function parseScoreInput(mode: InputMode, input: string): ParseResult<Score> {
  let processedInput = input
  let tempoBpm: number | undefined

  const tempoMatch = input.match(TEMPO_PREFIX_RE)
  if (tempoMatch) {
    const parsed = parseInt(tempoMatch[1] ?? '', 10)
    if (Number.isFinite(parsed) && parsed >= 20 && parsed <= 300) {
      tempoBpm = parsed
    }
    processedInput = input.slice(tempoMatch[0].length)
  }

  const result = mode === 'notes' ? parseNoteInput(processedInput) : parseChordInput(processedInput)

  if (tempoBpm !== undefined) {
    result.value.metadata.tempoBpm = tempoBpm
  }

  return result
}
