import type { InputMode, ParseResult, Score } from '../model/types'
import { parseChordInput } from './chordParser'
import { parseNoteInput } from './noteParser'
import { prepareStaffScript } from './staffScript'

export function parseScoreInput(mode: InputMode, input: string): ParseResult<Score> {
  const staffScript = prepareStaffScript(input)
  const activeMode = staffScript.mode ?? mode
  const parserOptions = {
    ...(staffScript.defaultDuration !== undefined ? { defaultDuration: staffScript.defaultDuration } : {}),
    ...(staffScript.metadata.beats !== undefined ? { beats: staffScript.metadata.beats } : {}),
    ...(staffScript.metadata.beatType !== undefined ? { beatType: staffScript.metadata.beatType } : {}),
  }
  const result = activeMode === 'notes'
    ? parseNoteInput(staffScript.input, parserOptions)
    : parseChordInput(staffScript.input, parserOptions)

  result.errors.unshift(...staffScript.errors)
  result.warnings.unshift(...staffScript.warnings)
  result.ok = result.errors.length === 0
  result.value.metadata = {
    ...result.value.metadata,
    ...staffScript.metadata,
    mode: activeMode,
    totalEvents: result.value.metadata.totalEvents,
  }

  return result
}
