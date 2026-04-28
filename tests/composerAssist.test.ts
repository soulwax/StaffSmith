import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runComposerAssist } from '../api/_lib/gemini'

const originalGeminiKey = process.env.GEMINI_API_KEY

function mockGeminiJson(payload: unknown) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify(payload),
                },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  )
}

describe('composer assist normalization', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-gemini-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalGeminiKey === undefined) {
      delete process.env.GEMINI_API_KEY
    } else {
      process.env.GEMINI_API_KEY = originalGeminiKey
    }
  })

  it('extracts StaffSmith notation when Gemini returns generatedInput as an object', async () => {
    mockGeminiJson({
      summary: { text: 'Beginner flute phrase with bright folk-jazz color.' },
      keyCenter: 'D minor',
      suggestedMode: 'notes',
      generatedInput: {
        notation: 'mp [airy flute] D5 q, F5 q, A5 h | < C6 q, A5 q, G5 q, F5 q | > E5 h, D5 h',
      },
      notes: [{ text: 'Playable beginner range.' }, 'Uses crescendo and diminuendo.'],
    })

    const result = await runComposerAssist({
      task: 'generate',
      mode: 'notes',
      input: 'C4 q E4 q G4 h',
      prompt: 'A flute solo for beginners, in the style of jethro tull jazz',
    })

    expect(result.generatedInput).toBe('mp [airy flute] D5 q, F5 q, A5 h | < C6 q, A5 q, G5 q, F5 q | > E5 h, D5 h')
    expect(result.generatedInput).not.toContain('[object Object]')
    expect(result.summary).toBe('Beginner flute phrase with bright folk-jazz color.')
    expect(result.notes).toEqual(['Playable beginner range.', 'Uses crescendo and diminuendo.'])
  })

  it('converts structured note objects into StaffSmith notation', async () => {
    mockGeminiJson({
      summary: 'Structured beginner flute idea.',
      keyCenter: 'D minor',
      suggestedMode: 'notes',
      generatedInput: {
        measures: [
          {
            directions: [{ kind: 'direction', dynamic: 'mp' }],
            notes: [
              { pitch: { step: 'D', octave: 5 }, duration: 'q' },
              { pitch: { step: 'F', octave: 5 }, duration: 'q' },
              { pitch: { step: 'A', octave: 5 }, duration: 'h' },
            ],
          },
          {
            events: [
              { kind: 'direction', directionKind: 'hairpin', value: 'crescendo' },
              { pitch: 'G5', duration: 'q' },
              { pitch: 'A5', duration: 'q' },
              { pitch: 'B5', duration: 'q' },
              { pitch: 'A5', duration: 'q' },
            ],
          },
        ],
      },
      notes: [],
    })

    const result = await runComposerAssist({
      task: 'generate',
      mode: 'notes',
      input: 'C4 q E4 q G4 h',
      prompt: 'A flute solo for beginners, in the style of jethro tull jazz',
    })

    expect(result.generatedInput).toBe('mp D5 q F5 q A5 h | < G5 q A5 q B5 q A5 q')
  })

  it('returns a parseable fallback when the pinned Gemini generation model is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }))

    const result = await runComposerAssist({
      task: 'generate',
      mode: 'notes',
      input: 'C4 q E4 q G4 h',
      prompt: 'A flute solo for beginners, in the style of jethro tull jazz',
    })

    expect(result.generatedInput).toBe('mp [airy flute] D5 q, F5 q, A5 h | < G5 q, A5 q, B5 q, A5 q | > G5 q, F5 q, E5 q, D5 q')
    expect(result.summary).toContain('local beginner flute fallback')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })
})
