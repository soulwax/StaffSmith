import type { ComposerAssistRequest, ComposerAssistResult } from '../../src/lib/apiTypes'
import { getGeminiApiKey } from './env'
import { fail } from './http'

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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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

function buildPrompt(payload: ComposerAssistRequest) {
  return `You are StaffSmith's music assistant. Return only JSON matching this TypeScript type:
{
  "summary": string,
  "keyCenter": string,
  "suggestedMode": "notes" | "chords",
  "generatedInput": string,
  "notes": string[]
}

StaffSmith syntax:
- notes mode examples: C4 q, D4 q, E4 h | G4 q
- chords mode examples: Cmaj7 | Am7 | Dm7 G7 | Cmaj7
- durations are w, h, q, 8
- keep generatedInput directly parseable by StaffSmith
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
