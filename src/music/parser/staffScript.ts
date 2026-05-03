import type { DurationSymbol, InputMode, ParseError, Score } from '../model/types'
import { isDurationSymbol } from '../theory/duration'
import { parseClef, parseKeySignature, parseTimeSignature } from '../theory/signatures'
import { createParseError } from './shared'

type MotifDefinition = {
  body: string
  index: number
}

export type StaffScriptDirectives = {
  input: string
  mode?: InputMode
  metadata: Partial<Score['metadata']>
  defaultDuration?: DurationSymbol
  errors: ParseError[]
  warnings: string[]
}

const METADATA_KEYS = new Set([
  'version',
  'title',
  'composer',
  'instrument',
  'tempo',
  'time',
  'key',
  'clef',
  'mode',
  'dur',
])

const MOTIF_NAME_RE = /^[A-Za-z][\w-]*$/

export function prepareStaffScript(input: string): StaffScriptDirectives {
  const errors: ParseError[] = []
  const warnings: string[] = []
  const metadata: Partial<Score['metadata']> = {
    sourceFormat: 'staffscript',
  }
  const unknown: Record<string, string> = {}
  const motifs = new Map<string, MotifDefinition>()
  const bodyLines: string[] = []
  let mode: InputMode | undefined
  let defaultDuration: DurationSymbol | undefined
  let offset = 0

  for (const line of input.split(/\r?\n/)) {
    const lineStart = offset
    offset += line.length + 1
    const trimmed = line.trim()

    if (!trimmed.startsWith('@')) {
      bodyLines.push(line)
      continue
    }

    const motifMatch = trimmed.match(/^@motif\s+([A-Za-z][\w-]*)\s*=\s*(.+)$/i)
    if (motifMatch) {
      const name = motifMatch[1] ?? ''
      motifs.set(name, {
        body: motifMatch[2] ?? '',
        index: lineStart + line.indexOf(name),
      })
      continue
    }

    const assignmentMatch = trimmed.match(/^@([A-Za-z][\w-]*)\s*=\s*(.*)$/)
    if (!assignmentMatch) {
      warnings.push(`Ignored StaffScript directive: ${trimmed}`)
      continue
    }

    const key = (assignmentMatch[1] ?? '').toLowerCase()
    const rawValue = assignmentMatch[2] ?? ''

    if (!METADATA_KEYS.has(key) && isLikelyMotifValue(rawValue)) {
      const originalName = assignmentMatch[1] ?? ''
      motifs.set(originalName, {
        body: rawValue,
        index: lineStart + line.indexOf(originalName),
      })
      continue
    }

    if (key === 'tempo') {
      const tempoMatch = rawValue.match(/^(\d+)(?:\s+(.*))?$/)
      const tempo = Number.parseInt(tempoMatch?.[1] ?? rawValue, 10)
      if (Number.isFinite(tempo) && tempo >= 20 && tempo <= 300) {
        metadata.tempoBpm = tempo
      } else {
        errors.push(createParseError(input, lineStart, '@tempo must be an integer from 20 to 300.', trimmed))
      }
      if (tempoMatch?.[2]) {
        bodyLines.push(tempoMatch[2])
      }
      continue
    }

    const value = unquote(rawValue.trim())

    if (key === 'version') {
      metadata.staffScriptVersion = value
      continue
    }

    if (key === 'title') {
      metadata.title = value
      continue
    }

    if (key === 'composer') {
      metadata.composer = value
      continue
    }

    if (key === 'instrument') {
      metadata.instrument = value
      continue
    }

    if (key === 'key') {
      metadata.key = value
      const parsedKey = parseKeySignature(value)
      if (parsedKey) {
        metadata.keyFifths = parsedKey.fifths
      } else {
        warnings.push(`Unknown @key "${value}"; MusicXML will use no key signature.`)
      }
      continue
    }

    if (key === 'clef') {
      const parsedClef = parseClef(value)
      if (parsedClef) {
        metadata.clef = parsedClef
      } else {
        errors.push(createParseError(input, lineStart, '@clef must be treble/violin, bass, alto, or tenor.', trimmed))
      }
      continue
    }

    if (key === 'time') {
      const parsedTime = parseTimeSignature(value)
      if (parsedTime) {
        metadata.beats = parsedTime.beats
        metadata.beatType = parsedTime.beatType
      } else {
        errors.push(createParseError(input, lineStart, '@time must use a value like 4/4, 6/8, common, or cut.', trimmed))
      }
      continue
    }

    if (key === 'mode') {
      if (value === 'notes' || value === 'chords') {
        mode = value
      } else {
        errors.push(createParseError(input, lineStart, '@mode must be notes or chords.', trimmed))
      }
      continue
    }

    if (key === 'dur') {
      if (isDurationSymbol(value)) {
        defaultDuration = value
        metadata.defaultDuration = value
      } else {
        errors.push(createParseError(input, lineStart, '@dur must be one of w, h, q, 8, 16, or 32.', trimmed))
      }
      continue
    }

    unknown[key] = value
  }

  if (Object.keys(unknown).length > 0) {
    metadata.unknown = unknown
  }

  const blockExpanded = expandBlocks(bodyLines.join('\n'), input, errors, motifs)
  const inputWithMotifs = expandMotifUses(blockExpanded, motifs, input, errors)

  return {
    input: inputWithMotifs,
    metadata,
    errors,
    warnings,
    ...(mode !== undefined ? { mode } : {}),
    ...(defaultDuration !== undefined ? { defaultDuration } : {}),
  }
}

function isLikelyMotifValue(value: string) {
  return /^\s*\(/.test(value)
    || /\buse\s+[A-Za-z][\w-]*\b/.test(value)
    || /[|,]/.test(value)
    || /\b[A-Ga-g](?:#|b)?\d+\b/.test(value)
    || /\b(?:pause|rest|R)\b/i.test(value)
}

function unquote(value: string) {
  const doubleQuoted = value.match(/^"(.*)"$/)
  if (doubleQuoted) {
    return doubleQuoted[1] ?? ''
  }

  const singleQuoted = value.match(/^'(.*)'$/)
  if (singleQuoted) {
    return singleQuoted[1] ?? ''
  }

  return value
}

function expandBlocks(
  source: string,
  originalInput: string,
  errors: ParseError[],
  motifs?: Map<string, MotifDefinition>,
): string {
  let output = ''
  let index = 0

  while (index < source.length) {
    const rest = source.slice(index)
    const sectionMatch = rest.match(/^section\s+([A-Za-z][\w-]*)\s*\{/i)
    const repeatMatch = rest.match(/^repeat\s+(\d+)\s*\{/i)
    const compactRepeatMatch = rest.match(/^x(\d+)\s*\{/i)

    if (sectionMatch) {
      const blockStart = index + (sectionMatch[0]?.length ?? 0) - 1
      const blockEnd = findMatchingBrace(source, blockStart)
      if (blockEnd === -1) {
        errors.push(createParseError(originalInput, index, 'Section block must be closed with }.', sectionMatch[0]))
        output += rest
        break
      }

      const name = sectionMatch[1] ?? 'section'
      const body = source.slice(blockStart + 1, blockEnd)
      if (motifs && !motifs.has(name)) {
        motifs.set(name, {
          body: `${body} |`,
          index,
        })
      }
      output += ` [section:${name}] ${expandBlocks(body, originalInput, errors, motifs)} | `
      index = blockEnd + 1
      continue
    }

    const activeRepeatMatch = repeatMatch ?? compactRepeatMatch
    if (activeRepeatMatch) {
      const blockStart = index + (activeRepeatMatch[0]?.length ?? 0) - 1
      const blockEnd = findMatchingBrace(source, blockStart)
      const count = Number.parseInt(activeRepeatMatch[1] ?? '', 10)

      if (!Number.isInteger(count) || count <= 0) {
        errors.push(createParseError(originalInput, index, 'Repeat count must be a positive integer.', activeRepeatMatch[0]))
      }

      if (blockEnd === -1) {
        errors.push(createParseError(originalInput, index, 'Repeat block must be closed with }.', activeRepeatMatch[0]))
        output += rest
        break
      }

      const body = expandBlocks(source.slice(blockStart + 1, blockEnd), originalInput, errors, motifs)
      if (count > 0) {
        output += `${Array.from({ length: count }, () => body).join(' | ')} | `
      }
      index = blockEnd + 1
      continue
    }

    output += source[index]
    index += 1
  }

  return output
}

function findMatchingBrace(source: string, openingIndex: number) {
  let depth = 0

  for (let index = openingIndex; index < source.length; index += 1) {
    const char = source[index]

    if (char === '{') {
      depth += 1
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }

  return -1
}

function expandMotifUses(
  source: string,
  motifs: Map<string, MotifDefinition>,
  originalInput: string,
  errors: ParseError[],
) {
  const expandText = (text: string, stack: string[]): string => text.replace(
    /\buse\s+([A-Za-z][\w-]*)\b/g,
    (match: string, name: string, offset: number) => {
      const motif = motifs.get(name)

      if (!motif) {
        errors.push(createParseError(originalInput, offset, `Unknown motif "${name}".`, match))
        return ''
      }

      if (stack.includes(name)) {
        errors.push(createParseError(originalInput, motif.index, `Motif "${name}" expands recursively.`, name))
        return ''
      }

      return ` ${expandText(expandBlocks(motif.body, originalInput, errors, motifs), [...stack, name])} `
    },
  )

  for (const name of motifs.keys()) {
    if (!MOTIF_NAME_RE.test(name)) {
      errors.push(createParseError(originalInput, motifs.get(name)?.index ?? 0, `Invalid motif name "${name}".`, name))
    }
  }

  return expandText(source, [])
}
