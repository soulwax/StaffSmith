import type { ComposerAssistRequest, ComposerAssistResult, GeminiStatusResponse } from '../../src/lib/apiTypes'
import { STAFFSMITH_AI_SYNTAX_GUIDE } from '../../src/music/parser/syntaxGuide'
import { getGeminiApiKey } from './env'
import { fail } from './http'

const GEMINI_MODEL = 'gemini-2.5-flash'

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
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
      }),
    },
  )

  if (!response.ok) {
    fail(response.status, 'Gemini request failed.')
  }

  const data = await response.json() as GeminiResponse
  const text = data.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text

  if (!text) {
    fail(502, 'Gemini returned an empty response.')
  }

  return normalizeAssistResult(JSON.parse(text) as Partial<ComposerAssistResult>, payload)
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
  result: Partial<ComposerAssistResult>,
  payload: ComposerAssistRequest,
): ComposerAssistResult {
  const suggestedMode = result.suggestedMode === 'chords' || result.suggestedMode === 'notes'
    ? result.suggestedMode
    : payload.mode

  return {
    summary: String(result.summary || 'No summary returned.'),
    keyCenter: String(result.keyCenter || 'Unknown'),
    suggestedMode,
    generatedInput: String(result.generatedInput || payload.input),
    notes: Array.isArray(result.notes)
      ? result.notes.map((note) => String(note)).slice(0, 6)
      : [],
  }
}
