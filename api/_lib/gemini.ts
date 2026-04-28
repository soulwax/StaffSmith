import type { ComposerAssistRequest, ComposerAssistResult, GeminiStatusResponse } from '../../src/lib/apiTypes.js'
import { STAFFSMITH_AI_SYNTAX_GUIDE } from '../../src/music/parser/syntaxGuide.js'
import type { InputMode } from '../../src/music/model/types.js'
import { getGeminiApiKey } from './env.js'
import { fail } from './http.js'

const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview'
const DEFAULT_GENERATED_NOTATION = 'mp [airy flute] D5 q, F5 q, A5 h | < G5 q, A5 q, B5 q, A5 q | > G5 q, F5 q, E5 q, D5 q'
const DURATION_VALUES = new Set(['w', 'h', 'q', '8'])
const DURATION_UNITS: Record<string, number> = { w: 8, h: 4, q: 2, '8': 1 }
const MAX_MEASURE_UNITS = 8

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
  const body = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: buildPrompt(payload),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: payload.task === 'generate' ? 0.85 : 0.35,
      responseMimeType: 'application/json',
    },
  })
  let response: Response | null = null

  response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

  return normalizeAssistResult(JSON.parse(text) as LooseComposerAssistResult, payload)
}

function createFallbackAssistResult(payload: ComposerAssistRequest, statusCode?: number): ComposerAssistResult {
  return {
    summary: statusCode
      ? `Gemini generation returned HTTP ${statusCode}, so StaffSmith used a local beginner flute fallback.`
      : 'Gemini generation was unavailable, so StaffSmith used a local beginner flute fallback.',
    keyCenter: 'D minor',
    suggestedMode: 'notes',
    generatedInput: DEFAULT_GENERATED_NOTATION,
    notes: [
      'Uses a beginner-friendly flute range.',
      'Keeps StaffSmith syntax parseable while Gemini is unavailable.',
      payload.prompt ? 'Try Generate again later for a fresh AI variation.' : 'Add a prompt and try again later for a fresh AI variation.',
    ],
  }
}

export async function checkGeminiAvailability(): Promise<GeminiStatusResponse> {
  const apiKey = getGeminiApiKey()
  const startedAt = Date.now()
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}?key=${apiKey}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
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
      model: GEMINI_MODEL,
    }
  }

  return {
    available: true,
    checkedAt: new Date().toISOString(),
    latencyMs,
    message: 'Gemini available.',
    model: GEMINI_MODEL,
  }
}

function buildPrompt(payload: ComposerAssistRequest) {
  return `You are StaffSmith's music assistant. Return only JSON matching this TypeScript type:
{
  "summary": string,
  "keyCenter": string,
  "suggestedMode": "notes" | "chords",
  "generatedInput": string,
  "notes": string[]
}

${STAFFSMITH_AI_SYNTAX_GUIDE}

Generation rules:
- keep generatedInput directly parseable by StaffSmith
- generatedInput must be a single plain StaffSmith notation string, not an object, array, markdown block, or JSON structure
- do not return nested notes, measures, events, pitch objects, or token objects inside generatedInput
- for natural-language note generation, prefer suggestedMode "notes"
- include useful notation tokens from the syntax when the user asks for mood, dynamics, articulation, or intensity
- if the user names an artist or band, translate that into broad musical traits instead of imitating the named artist directly
- keep notes concise and practical

Task: ${payload.task}
Current mode: ${payload.mode}
Current input:
${payload.input || '(empty)'}

User prompt:
${payload.prompt || '(none)'}`
}

function normalizeAssistResult(
  result: LooseComposerAssistResult,
  payload: ComposerAssistRequest,
): ComposerAssistResult {
  const suggestedMode = result.suggestedMode === 'chords' || result.suggestedMode === 'notes'
    ? result.suggestedMode
    : payload.mode

  return {
    summary: coerceText(result.summary, 'No summary returned.'),
    keyCenter: coerceText(result.keyCenter, 'Unknown'),
    suggestedMode,
    generatedInput: coerceGeneratedInput(result.generatedInput, payload, suggestedMode),
    notes: coerceNotes(result.notes),
  }
}

function coerceGeneratedInput(value: unknown, payload: ComposerAssistRequest, mode: InputMode) {
  const candidates = collectNotationCandidates(value)
  const fallback = payload.task === 'generate'
    ? [DEFAULT_GENERATED_NOTATION]
    : collectNotationCandidates(payload.input)

  for (const candidate of [...candidates, ...fallback]) {
    const normalized = candidate.trim()
    if (!normalized || normalized.includes('[object Object]')) {
      continue
    }

    if (isLikelyParseableStaffSmithInput(mode, normalized)) {
      return normalized
    }
  }

  fail(502, 'Gemini returned generatedInput in an unsupported format.')
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

  const pitch = pitchToken(value.pitch)
    ?? pitchToken(value.note)
    ?? pitchToken(value)
  if (!pitch) {
    return null
  }

  const duration = durationToken(value.duration) ?? 'q'
  return `${pitch} ${duration}`
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
  return duration && DURATION_VALUES.has(duration) ? duration : null
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

function isLikelyParseableStaffSmithInput(mode: InputMode, input: string) {
  const tokens = input.match(/\[[^\]]+\]|\||,|[^\s|,]+/g) ?? []
  if (tokens.length === 0) {
    return false
  }

  if (mode === 'chords') {
    return tokens.some((token) => token !== '|' && token !== ',' && !isDirectionToken(token))
  }

  let noteCount = 0
  let measureUnits = 0

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token) {
      continue
    }

    if (token === '|') {
      if (measureUnits > MAX_MEASURE_UNITS) {
        return false
      }
      measureUnits = 0
      continue
    }

    if (token === ',' || isDirectionToken(token)) {
      continue
    }

    if (!/^[A-Ga-g](?:#|b)?\d+$/.test(token)) {
      return false
    }

    noteCount += 1
    const nextToken = tokens[index + 1]
    let durationKey = 'q'
    if (nextToken && DURATION_VALUES.has(nextToken)) {
      durationKey = nextToken
      index += 1
    }
    measureUnits += DURATION_UNITS[durationKey] ?? 2
  }

  if (measureUnits > MAX_MEASURE_UNITS) {
    return false
  }

  return noteCount > 0
}

function isDirectionToken(token: string) {
  return /^(pp|p|mp|mf|f|ff|dolce|legato|staccato|tenuto|cantabile|espressivo|rit\.?|accel\.?|a-tempo|tempo|<|>|cresc\.?|crescendo|dim\.?|decresc\.?|diminuendo|\[[^\]]+\])$/i.test(token)
}
