import type { ComposerAssistRequest, ComposerAssistResult, GeminiStatusResponse } from '../../src/lib/apiTypes.js'
import { STAFFSMITH_AI_SYNTAX_GUIDE } from '../../src/music/parser/syntaxGuide.js'
import type { DurationSymbol, InputMode } from '../../src/music/model/types.js'
import { parseScoreInput } from '../../src/music/parser/index.js'
import { getGeminiApiKey } from './env.js'
import { GEMINI_CONFIG } from './gemini.config.js'
import { fail } from './http.js'

const DURATION_VALUES = new Set<DurationSymbol>(['w', 'h', 'q', '8', '16', '32'])
const DURATION_UNITS: Record<DurationSymbol, number> = { w: 32, h: 16, q: 8, '8': 4, '16': 2, '32': 1 }
const MAX_MEASURE_UNITS = 32
const REST_FILL_DURATIONS: DurationSymbol[] = ['w', 'h', 'q', '8', '16', '32']
const FLAT_NOTATION_TOKEN_PATTERN = /\[[^\]]+\]|\||,|\(|\)|[<>]|[A-Ga-g](?:#|b)?\d+|[Rr](?:est)?|pause|w|h|q|8|16|32|\S+/gi
const CHORD_NOTATION_TOKEN_PATTERN = /\[[^\]]+\]|\||,|[<>]|[^\s|,]+/g
const CHORD_SYMBOL_PATTERN = /^[A-Ga-g](?:#|b)?(?:m|min|maj7|min7|m7|7|dim|aug|sus|sus2|sus4|add9)?$/

type LooseComposerAssistResult = Omit<Partial<ComposerAssistResult>, 'generatedInput' | 'notes'> & {
  generatedInput?: unknown
  notes?: unknown
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

export async function runComposerAssist(payload: ComposerAssistRequest): Promise<ComposerAssistResult> {
  const apiKey = getGeminiApiKey()
  const generationConfig = GEMINI_CONFIG.generation[payload.task]
  const body = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [{ text: buildPrompt(payload) }],
      },
    ],
    generationConfig,
  })
  let response: Response | null = null

  response = await fetch(
    `${GEMINI_CONFIG.apiBase}/${GEMINI_CONFIG.model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  )

  if (!response?.ok) {
    if (payload.task === 'generate') {
      return createFallbackAssistResult(payload, response?.status)
    }

    fail(response?.status ?? 502, response?.status ? `Gemini request failed with HTTP ${response.status}.` : 'Gemini request failed.')
  }

  const data = await response.json() as GeminiResponse
  const text = data.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text

  if (!text) {
    fail(502, 'Gemini returned an empty response.')
  }

  const parsedResult = parseJsonFromGeminiText(text)
  if (!parsedResult.ok) {
    if (payload.task === 'generate') {
      return createFallbackAssistResult(payload)
    }

    fail(502, 'Gemini returned JSON that StaffSmith could not parse.')
  }

  return normalizeAssistResult(parsedResult.value as LooseComposerAssistResult, payload)
}

function createFallbackAssistResult(payload: ComposerAssistRequest, statusCode?: number): ComposerAssistResult {
  const generatedInput = createFallbackNotation(payload)
  const fallbackKind = payload.mode === 'chords' ? 'lead-sheet chord' : 'beginner flute'
  const baseFallback = getBaseFallbackNotation(payload.mode)
  return {
    summary: statusCode
      ? `Gemini generation returned HTTP ${statusCode}, so StaffSmith used a local ${fallbackKind} fallback.`
      : `Gemini generation was unavailable, so StaffSmith used a local ${fallbackKind} fallback.`,
    keyCenter: payload.mode === 'chords' ? 'C major' : 'D minor',
    suggestedMode: payload.mode,
    generatedInput,
    notes: [
      payload.mode === 'chords'
        ? 'Uses supported lead-sheet chord symbols.'
        : 'Uses a beginner-friendly flute range.',
      'Keeps StaffSmith syntax parseable while Gemini is unavailable.',
      generatedInput !== baseFallback ? 'Expanded locally to honor the requested long-form measure count.' : '',
      payload.prompt ? 'Try Generate again later for a fresh AI variation.' : 'Add a prompt and try again later for a fresh AI variation.',
    ].filter(Boolean),
  }
}

function parseJsonFromGeminiText(text: string): { ok: true, value: unknown } | { ok: false } {
  const jsonSlice = extractFirstJsonValue(text)

  if (!jsonSlice) {
    return { ok: false }
  }

  try {
    return { ok: true, value: JSON.parse(jsonSlice) as unknown }
  } catch {
    return { ok: false }
  }
}

function extractFirstJsonValue(text: string): string | null {
  const trimmed = text.trim()
  const start = findFirstJsonStart(trimmed)

  if (start === -1) {
    return null
  }

  const stack: string[] = []
  let inString = false
  let escaped = false

  for (let index = start; index < trimmed.length; index += 1) {
    const character = trimmed[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }

      if (character === '\\') {
        escaped = true
        continue
      }

      if (character === '"') {
        inString = false
      }
      continue
    }

    if (character === '"') {
      inString = true
      continue
    }

    if (character === '{' || character === '[') {
      stack.push(character === '{' ? '}' : ']')
      continue
    }

    if (character === '}' || character === ']') {
      if (stack.pop() !== character) {
        return null
      }

      if (stack.length === 0) {
        return trimmed.slice(start, index + 1)
      }
    }
  }

  return null
}

function findFirstJsonStart(text: string) {
  const objectStart = text.indexOf('{')
  const arrayStart = text.indexOf('[')

  if (objectStart !== -1) {
    return objectStart
  }

  return arrayStart
}

export async function checkGeminiAvailability(): Promise<GeminiStatusResponse> {
  const apiKey = getGeminiApiKey()
  const startedAt = Date.now()
  const response = await fetch(
    `${GEMINI_CONFIG.apiBase}/${GEMINI_CONFIG.model}?key=${apiKey}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
  )
  const latencyMs = Date.now() - startedAt

  if (!response.ok) {
    return {
      available: false,
      checkedAt: new Date().toISOString(),
      latencyMs,
      message: response.status === 403 || response.status === 401
        ? 'Gemini key rejected.'
        : `Gemini status check failed with HTTP ${response.status}.`,
      model: GEMINI_CONFIG.model,
    }
  }

  return {
    available: true,
    checkedAt: new Date().toISOString(),
    latencyMs,
    message: 'Gemini available.',
    model: GEMINI_CONFIG.model,
  }
}

function buildPrompt(payload: ComposerAssistRequest) {
  const rules = GEMINI_CONFIG.generationRules.map((rule) => `- ${rule}`).join('\n')
  const modeInstruction = payload.mode === 'chords'
    ? 'The active tab is Chords. Generate chord-mode StaffScript only: lead-sheet chord symbols, @mode=chords when using headers, up to four chord symbols per measure, and no note pitches or note durations.'
    : 'The active tab is Notes. Generate notes-mode StaffScript only: octave-numbered pitches, explicit durations when useful, rests/pauses, slurs, dynamics, expressions, and complete 4/4 measures.'

  return `${GEMINI_CONFIG.systemInstruction}

${STAFFSMITH_AI_SYNTAX_GUIDE}

Generation rules:
${rules}

Task: ${payload.task}
Current mode: ${payload.mode}
Mode-specific instruction:
${modeInstruction}

Current input:
${payload.input || '(empty)'}

User prompt:
${payload.prompt || '(none)'}`
}

function normalizeAssistResult(
  result: LooseComposerAssistResult,
  payload: ComposerAssistRequest,
): ComposerAssistResult {
  const suggestedMode = payload.task === 'generate'
    ? payload.mode
    : normalizeSuggestedMode(result.suggestedMode, payload.mode)

  return {
    summary: coerceText(result.summary, 'No summary returned.'),
    keyCenter: coerceText(result.keyCenter, 'Unknown'),
    suggestedMode,
    generatedInput: coerceGeneratedInput(result.generatedInput, payload, suggestedMode),
    notes: coerceNotes(result.notes),
  }
}

function normalizeSuggestedMode(value: unknown, fallback: InputMode) {
  return value === 'chords' || value === 'notes' ? value : fallback
}

function coerceGeneratedInput(value: unknown, payload: ComposerAssistRequest, mode: InputMode) {
  const candidates = collectNotationCandidates(value)
  const fallback = payload.task === 'generate'
    ? [createFallbackNotation(payload)]
    : collectNotationCandidates(payload.input)
  const requestedMeasureCount = payload.task === 'generate' ? getRequestedMeasureCount(payload.prompt) : null

  for (const candidate of [...candidates, ...fallback]) {
    const normalized = cleanGeneratedNotation(candidate)
    if (!normalized || normalized.includes('[object Object]')) {
      continue
    }

    const parseableCandidate = getParseableStaffScriptCandidate(mode, normalized)
    if (parseableCandidate) {
      return requestedMeasureCount
        ? expandNotationToMeasureCount(parseableCandidate, requestedMeasureCount)
        : parseableCandidate
    }
  }

  fail(502, 'Gemini returned generatedInput in an unsupported format.')
}

function createFallbackNotation(payload: ComposerAssistRequest) {
  const requestedMeasureCount = getRequestedMeasureCount(payload.prompt)
  const fallbackNotation = getBaseFallbackNotation(payload.mode)

  return requestedMeasureCount
    ? expandNotationToMeasureCount(fallbackNotation, requestedMeasureCount)
    : fallbackNotation
}

function getBaseFallbackNotation(mode: InputMode) {
  return mode === 'chords' ? GEMINI_CONFIG.chordFallbackNotation : GEMINI_CONFIG.fallbackNotation
}

function getRequestedMeasureCount(prompt: string | undefined): number | null {
  const normalized = prompt?.toLowerCase() ?? ''
  if (!normalized.trim()) {
    return null
  }

  const explicitMeasureMatch = normalized.match(/(?:at\s+least|minimum|expected\s+length\s*:?\s*|around|about|approximately|make\s+it)?\s*(\d{2,3})\s*(?:4\/4\s*)?(?:measures?|bars?)\b/)
  const explicitMeasureCount = explicitMeasureMatch?.[1] ? Number(explicitMeasureMatch[1]) : null
  if (explicitMeasureCount && Number.isFinite(explicitMeasureCount)) {
    return Math.max(1, Math.min(GEMINI_CONFIG.longGeneration.maxGeneratedMeasures, Math.round(explicitMeasureCount)))
  }

  if (/\b5[\s-]*(?:minute|min)\b/.test(normalized) || /\bfive[\s-]*(?:minute|min)\b/.test(normalized)) {
    return GEMINI_CONFIG.longGeneration.fiveMinuteMeasures
  }

  if (/\b(?:long|full|complete|extended)\b/.test(normalized)) {
    return GEMINI_CONFIG.longGeneration.defaultLongMeasures
  }

  return null
}

function expandNotationToMeasureCount(input: string, targetMeasureCount: number) {
  const { directives, body } = splitLeadingDirectives(input)
  const measures = splitMeasures(body)
  if (measures.length === 0 || measures.length >= targetMeasureCount) {
    return input
  }

  const expanded: string[] = []
  for (let index = 0; index < targetMeasureCount; index += 1) {
    const measure = measures[index % measures.length]!
    expanded.push(index > 0 && index % measures.length === 0
      ? addLongFormSectionMarker(measure, index)
      : measure)
  }

  const expandedBody = expanded.join(' | ')
  return [directives.join('\n'), expandedBody].filter(Boolean).join('\n\n')
}

function splitMeasures(input: string) {
  return input
    .split('|')
    .map((measure) => measure.trim())
    .filter(Boolean)
}

function addLongFormSectionMarker(measure: string, measureIndex: number) {
  const markers = ['[return]', '[middle]', '[freestyle]', '[finale]', '[coda]']
  const marker = markers[Math.floor(measureIndex / 16) % markers.length] ?? '[return]'

  return `${marker} ${measure}`
}

function cleanGeneratedNotation(input: string) {
  const trimmed = input.trim()
  const fenced = trimmed.match(/^```(?:staffscript|staff|txt|text|notes?)?\s*([\s\S]*?)\s*```$/i)
  const withoutFence = fenced?.[1] ?? trimmed

  return withoutFence
    .replace(/^\s*(?:StaffScript|generatedInput|notation)\s*:\s*/i, '')
    .trim()
}

function getParseableStaffScriptCandidate(mode: InputMode, input: string): string | null {
  if (isParseableStaffScriptInput(mode, input)) {
    return maybeCompleteGeneratedMeasures(mode, input)
  }

  const repaired = repairGeneratedNotation(mode, input)
  return repaired && isParseableStaffScriptInput(mode, repaired) ? repaired : null
}

function isParseableStaffScriptInput(mode: InputMode, input: string) {
  if (!parseScoreInput(mode, input).ok) {
    return false
  }

  if (mode !== 'chords') {
    return true
  }

  const { body } = splitLeadingDirectives(input)
  const flattenedBody = flattenStaffScriptForValidation(body)
  return flattenedBody ? hasLikelyChordInput(flattenedBody) : false
}

function maybeCompleteGeneratedMeasures(mode: InputMode, input: string) {
  if (mode !== 'notes' || !usesDefaultFourFour(input)) {
    return input
  }

  if (!hasIncompleteFlatNoteMeasure(input) || !isFlatNoteNotation(input)) {
    return input
  }

  const repaired = repairGeneratedNotation(mode, input)
  return repaired && isParseableStaffScriptInput(mode, repaired) ? repaired : input
}

function repairGeneratedNotation(mode: InputMode, input: string): string | null {
  if (mode !== 'notes' || !usesDefaultFourFour(input) || !isFlatNoteNotation(input)) {
    return null
  }

  const { directives, body } = splitLeadingDirectives(input)
  const tokens = body.match(FLAT_NOTATION_TOKEN_PATTERN) ?? []
  if (tokens.length === 0) {
    return null
  }

  const output: string[] = []
  let measureUnits = 0
  let repaired = false

  const pushBar = () => {
    if (output[output.length - 1] === '|') {
      return
    }

    output.push('|')
    measureUnits = 0
  }

  const pushRests = (remainingUnits: number) => {
    for (const duration of REST_FILL_DURATIONS) {
      const durationUnits = DURATION_UNITS[duration]
      while (remainingUnits >= durationUnits) {
        output.push('R', duration)
        remainingUnits -= durationUnits
        repaired = true
      }
    }
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? ''
    if (!token) {
      continue
    }

    if (token === '|') {
      if (measureUnits > 0 && measureUnits < MAX_MEASURE_UNITS) {
        pushRests(MAX_MEASURE_UNITS - measureUnits)
      }
      pushBar()
      continue
    }

    if (token === ',' || token === '(' || token === ')' || isDirectionToken(token)) {
      output.push(token)
      continue
    }

    const isNote = /^[A-Ga-g](?:#|b)?\d+$/.test(token)
    const isRest = /^r(?:est)?$/i.test(token) || /^pause$/i.test(token)
    if (!isNote && !isRest) {
      return null
    }

    const nextToken = tokens[index + 1]
    const duration = nextToken && isGeneratedDuration(nextToken) ? nextToken : 'q'
    const units = DURATION_UNITS[duration]

    if (measureUnits > 0 && measureUnits + units > MAX_MEASURE_UNITS) {
      pushBar()
      repaired = true
    }

    output.push(token)
    if (nextToken && isGeneratedDuration(nextToken)) {
      output.push(nextToken)
      index += 1
    }
    measureUnits += units

    if (measureUnits === MAX_MEASURE_UNITS) {
      pushBar()
    }
  }

  if (measureUnits > 0 && measureUnits < MAX_MEASURE_UNITS) {
    pushRests(MAX_MEASURE_UNITS - measureUnits)
    pushBar()
  }

  const repairedBody = stringifyNotationTokens(output)
  if (!repaired || !repairedBody) {
    return null
  }

  return [directives.join('\n'), repairedBody].filter(Boolean).join('\n\n')
}

function splitLeadingDirectives(input: string) {
  const directives: string[] = []
  const bodyLines: string[] = []
  let hasSeenBody = false

  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!hasSeenBody && (trimmed === '' || trimmed.startsWith('@'))) {
      if (trimmed) {
        directives.push(line)
      }
      continue
    }

    hasSeenBody = true
    bodyLines.push(line)
  }

  return {
    directives,
    body: bodyLines.join('\n').trim(),
  }
}

function usesDefaultFourFour(input: string) {
  const timeMatch = input.match(/^@time\s*=\s*(.+)$/im)
  return !timeMatch || timeMatch[1]?.trim() === '4/4'
}

function isFlatNoteNotation(input: string) {
  const { body } = splitLeadingDirectives(input)
  return !/\b(?:section|repeat|x\d+|use)\b|[{}]/i.test(body)
}

function stringifyNotationTokens(tokens: string[]) {
  const compact = tokens.filter(Boolean)
  let output = ''

  for (const token of compact) {
    if (token === ',') {
      output = `${output.trimEnd()},`
      continue
    }

    if (token === '|') {
      output = `${output.trimEnd()} | `
      continue
    }

    if (token === ')') {
      output = `${output.trimEnd()} )`
      continue
    }

    output += output && !output.endsWith(' ') ? ` ${token}` : token
  }

  return output.replace(/\s+\|$/g, '').trim()
}

function hasIncompleteFlatNoteMeasure(input: string) {
  const { body } = splitLeadingDirectives(input)
  const measureUnits = getFlatNoteMeasureUnits(body)
  return Boolean(measureUnits?.some((units) => units > 0 && units < MAX_MEASURE_UNITS))
}

function flattenStaffScriptForValidation(input: string): string | null {
  const motifs = new Map<string, string>()
  let body = input
    .replace(/\/\/.*$/gm, ' ')
    .replace(/^\s*@motif\s+([A-Za-z][\w-]*)\s*=\s*(.+)$/gim, (_match, name: string, value: string) => {
      motifs.set(name.toLowerCase(), value.trim())
      return ' '
    })
    .replace(/^\s*@.*$/gm, ' ')

  body = body.replace(/\buse\s+([A-Za-z][\w-]*)\b/gi, (_match, name: string) => motifs.get(name.toLowerCase()) ?? ' ')

  let previousBody = ''
  while (previousBody !== body) {
    previousBody = body
    body = body
      .replace(/\bsection\s+([A-Za-z][\w -]*)\s*\{([^{}]*)\}/gi, (_match, name: string, content: string) => ` [${slugifySectionName(name)}] ${content} `)
      .replace(/\brepeat\s+(\d+)\s*\{([^{}]*)\}/gi, (_match, count: string, content: string) => repeatStaffScriptContent(count, content))
      .replace(/\bx(\d+)\s*\{([^{}]*)\}/gi, (_match, count: string, content: string) => repeatStaffScriptContent(count, content))
  }

  if (/[{}]/.test(body)) {
    return null
  }

  return body.trim() || null
}

function repeatStaffScriptContent(count: string, content: string) {
  const repeatCount = Math.max(1, Math.min(16, Number(count) || 1))
  return Array.from({ length: repeatCount }, () => content.trim()).filter(Boolean).join(' | ')
}

function slugifySectionName(name: string) {
  return name.trim().replace(/[^\w -]/g, '').replace(/\s+/g, '-').toLowerCase() || 'section'
}

function hasLikelyChordInput(input: string) {
  const tokens = input.match(CHORD_NOTATION_TOKEN_PATTERN) ?? []
  if (tokens.length === 0) {
    return false
  }

  let sawChord = false
  let chordCountInMeasure = 0

  for (const token of tokens) {
    if (!token || token === ',') {
      continue
    }

    if (token === '|') {
      chordCountInMeasure = 0
      continue
    }

    if (isDirectionToken(token)) {
      continue
    }

    if (isGeneratedChordSymbol(token)) {
      chordCountInMeasure += 1
      if (chordCountInMeasure > 4) {
        return false
      }

      sawChord = true
      continue
    }

    if (
      token === '('
      || token === ')'
      || isGeneratedDuration(token)
      || /^[A-Ga-g](?:#|b)?\d+$/.test(token)
      || /^r(?:est)?$/i.test(token)
      || /^pause$/i.test(token)
    ) {
      return false
    }

    return false
  }

  return sawChord
}

function getFlatNoteMeasureUnits(input: string): number[] | null {
  const tokens = input.match(FLAT_NOTATION_TOKEN_PATTERN) ?? []
  if (tokens.length === 0) {
    return null
  }

  const measures: number[] = []
  let currentUnits = 0
  let sawEvent = false
  let openSlur = false

  const pushMeasure = () => {
    if (currentUnits > MAX_MEASURE_UNITS) {
      return false
    }

    measures.push(currentUnits)
    currentUnits = 0
    return true
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? ''
    if (!token || token === ',') {
      continue
    }

    if (token === '(') {
      if (openSlur) {
        return null
      }

      openSlur = true
      continue
    }

    if (token === ')') {
      if (!openSlur) {
        return null
      }

      openSlur = false
      continue
    }

    if (token === '|') {
      if (!pushMeasure()) {
        return null
      }

      continue
    }

    if (isDirectionToken(token)) {
      continue
    }

    if (isGeneratedDuration(token)) {
      return null
    }

    const isNote = /^[A-Ga-g](?:#|b)?\d+$/.test(token)
    const isRest = /^r(?:est)?$/i.test(token) || /^pause$/i.test(token)
    if (!isNote && !isRest) {
      return null
    }

    const nextToken = tokens[index + 1]
    const duration = nextToken && isGeneratedDuration(nextToken) ? nextToken : 'q'
    currentUnits += DURATION_UNITS[duration]
    sawEvent = true

    if (nextToken && isGeneratedDuration(nextToken)) {
      index += 1
    }
  }

  if (openSlur || currentUnits > MAX_MEASURE_UNITS) {
    return null
  }

  if (currentUnits > 0 || measures.length === 0) {
    measures.push(currentUnits)
  }

  return sawEvent ? measures : null
}

function collectNotationCandidates(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }

  if (Array.isArray(value)) {
    const structuredMeasure = buildMeasureNotation(value)
    const directStringItems = value.filter((item): item is string => typeof item === 'string')
    return [
      ...(structuredMeasure ? [structuredMeasure] : []),
      ...(directStringItems.length > 0 ? [directStringItems.join(' ')] : []),
      ...value.flatMap(collectNotationCandidates),
    ]
  }

  if (isRecord(value)) {
    const structuredNotation = buildStructuredNotation(value)
    const preferredKeys = [
      'generatedInput',
      'input',
      'notation',
      'staffsmith',
      'staffSmith',
      'source',
      'text',
      'notes',
      'score',
      'measures',
    ]

    return [
      ...(structuredNotation ? [structuredNotation] : []),
      ...preferredKeys.flatMap((key) => collectNotationCandidates(value[key])),
    ]
  }

  return []
}

function buildStructuredNotation(value: Record<string, unknown>): string | null {
  const measures = arrayValue(value.measures) ?? arrayValue(value.bars)
  if (measures) {
    const measureText = measures
      .map((measure) => {
        if (typeof measure === 'string') {
          return measure
        }

        if (Array.isArray(measure)) {
          return buildMeasureNotation(measure)
        }

        if (isRecord(measure)) {
          return buildMeasureNotation([
            ...(arrayValue(measure.directions) ?? []),
            ...(arrayValue(measure.events) ?? []),
            ...(arrayValue(measure.notes) ?? []),
          ])
        }

        return null
      })
      .filter((measure): measure is string => Boolean(measure))

    return measureText.length > 0 ? measureText.join(' | ') : null
  }

  const events = arrayValue(value.events) ?? arrayValue(value.notes)
  if (events) {
    return buildMeasureNotation(events)
  }

  const eventToken = buildEventToken(value)
  return eventToken
}

function buildMeasureNotation(events: unknown[]): string | null {
  const tokens = events
    .map(buildEventToken)
    .filter((token): token is string => Boolean(token))

  return tokens.length > 0 ? tokens.join(' ') : null
}

function buildEventToken(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null
  }

  if (!isRecord(value)) {
    return null
  }

  const explicitText = textValue(value.notation)
    ?? textValue(value.staffsmith)
    ?? textValue(value.staffSmith)
    ?? textValue(value.token)
  if (explicitText) {
    return explicitText
  }

  const direction = directionToken(value)
  if (direction) {
    return direction
  }

  const kind = textValue(value.kind)?.toLowerCase()
  const hasRest = kind === 'rest' || value.rest === true
  if (hasRest) {
    const duration = durationToken(value.duration) ?? 'q'
    return `R ${duration}`
  }

  const pitch = pitchToken(value.pitch)
    ?? pitchToken(value.note)
    ?? pitchToken(value)
  if (!pitch) {
    return null
  }

  const duration = durationToken(value.duration) ?? 'q'
  const noteToken = `${pitch} ${duration}`
  const slurStart = value.slurStart === true || value.slur === 'start'
  const slurStop = value.slurStop === true || value.slur === 'stop'
  return `${slurStart ? '( ' : ''}${noteToken}${slurStop ? ' )' : ''}`
}

function directionToken(value: Record<string, unknown>) {
  const kind = textValue(value.kind)?.toLowerCase()
  const directionKind = textValue(value.directionKind)?.toLowerCase()
  const valueText = textValue(value.value)?.toLowerCase()
  const dynamic = textValue(value.dynamic)?.toLowerCase()
  const expression = textValue(value.expression)?.toLowerCase()
  const text = textValue(value.text)?.toLowerCase()
  const directionText = text ?? dynamic ?? expression

  if (kind !== 'direction' && !directionKind && !valueText && !dynamic && !expression) {
    return null
  }

  if (directionKind === 'hairpin' || valueText === 'crescendo' || valueText === 'diminuendo') {
    return valueText === 'diminuendo' || directionText === 'dim.' || directionText === 'diminuendo' ? '>' : '<'
  }

  return directionText
}

function pitchToken(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return /^[A-Ga-g](?:#|b)?\d+$/.test(normalized) ? normalized : null
  }

  if (!isRecord(value)) {
    return null
  }

  const scientific = textValue(value.scientific)
  if (scientific) {
    return pitchToken(scientific)
  }

  const step = textValue(value.step)?.toUpperCase()
  const octave = numberOrText(value.octave)
  const alter = Number(value.alter ?? 0)
  if (!step || !/^[A-G]$/.test(step) || !octave) {
    return null
  }

  const accidental = alter === 1 ? '#' : alter === -1 ? 'b' : ''
  return `${step}${accidental}${octave}`
}

function durationToken(value: unknown) {
  const duration = numberOrText(value)
  return duration && isGeneratedDuration(duration) ? duration : null
}

function arrayValue(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberOrText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return textValue(value)
}

function coerceText(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (isRecord(value)) {
    for (const key of ['text', 'summary', 'message', 'value']) {
      const text = value[key]
      if (typeof text === 'string' && text.trim()) {
        return text.trim()
      }
    }
  }

  return fallback
}

function coerceNotes(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((note) => coerceText(note, ''))
    .filter(Boolean)
    .slice(0, 6)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isGeneratedDuration(value: string): value is DurationSymbol {
  return DURATION_VALUES.has(value as DurationSymbol)
}

function isGeneratedChordSymbol(value: string) {
  return CHORD_SYMBOL_PATTERN.test(value)
}

function isDirectionToken(token: string) {
  return /^(pp|p|mp|mf|f|ff|dolce|legato|staccato|tenuto|cantabile|espressivo|rit\.?|accel\.?|a-tempo|tempo|<|>|cresc\.?|crescendo|dim\.?|decresc\.?|diminuendo|\[[^\]]+\])$/i.test(token)
}
