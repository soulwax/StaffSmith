import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runComposerAssist } from '../api/_lib/gemini'
import { GEMINI_CONFIG } from '../api/_lib/gemini.config'
import { STAFFSMITH_AI_SYNTAX_GUIDE } from '../src/music/parser/syntaxGuide'

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

    expect(result.generatedInput).toBe(GEMINI_CONFIG.fallbackNotation)
    expect(result.summary).toContain('local beginner flute fallback')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('rejects a measure that overflows 4/4 before it reaches the editor', async () => {
    mockGeminiJson({
      summary: 'Overfull last measure.',
      keyCenter: 'D minor',
      suggestedMode: 'notes',
      // measure 3: 6 eighths (3 beats) + 1 half (2 beats) = 5 beats — exceeds 4/4
      generatedInput: 'mf D5 8, F5 8, A5 8, C6 8, D6 q, A5 8, F5 8 | < G5 8, A5 8, Bb5 8, A5 8, G5 8, F5 8, E5 8, D5 8 | > D5 8, F5 8, A5 8, F5 8, G5 8, E5 8, D5 h',
      notes: [],
    })

    const result = await runComposerAssist({
      task: 'generate',
      mode: 'notes',
      input: 'C4 q E4 q G4 h',
      prompt: 'A flute solo for experts in the style of jethro tull jazz',
    })

    // The overfull measure is rejected and falls back to DEFAULT_GENERATED_NOTATION
    expect(result.generatedInput).toBe(GEMINI_CONFIG.fallbackNotation)
    // Summary is still taken from the Gemini response since the HTTP call succeeded
    expect(result.summary).toBe('Overfull last measure.')
  })

  it('rejects unsupported generated durations before they reach the editor', async () => {
    mockGeminiJson({
      summary: 'Contains an unsupported dotted duration.',
      keyCenter: 'C Major',
      suggestedMode: 'notes',
      generatedInput: 'C4 q E4 h. G4 q',
      notes: [],
    })

    const result = await runComposerAssist({
      task: 'generate',
      mode: 'notes',
      input: 'C4 q E4 q G4 h',
      prompt: 'A flute solo for beginners, in the style of jethro tull jazz',
    })

    expect(result.generatedInput).toBe(GEMINI_CONFIG.fallbackNotation)
  })

  it('accepts generated rests now that the composer board can insert them', async () => {
    mockGeminiJson({
      summary: 'Phrase with a clear breath.',
      keyCenter: 'C major',
      suggestedMode: 'notes',
      generatedInput: 'mf C4 h, R h | G4 w',
      notes: ['Uses a half-rest breath before the held note.'],
    })

    const result = await runComposerAssist({
      task: 'generate',
      mode: 'notes',
      input: 'C4 q E4 q G4 h',
      prompt: 'Leave a little space before the final note.',
    })

    expect(result.generatedInput).toBe('mf C4 h, R h | G4 w')
  })

  it('accepts generated pauses, fast durations, and slurs', async () => {
    mockGeminiJson({
      summary: 'Phrase with a smooth pickup and pause.',
      keyCenter: 'C major',
      suggestedMode: 'notes',
      generatedInput: '( C4 8, D4 8, E4 q ) pause q, G4 32, A4 32, B4 16, C5 8',
      notes: ['Uses a slur and short notes before the pause resolves.'],
    })

    const result = await runComposerAssist({
      task: 'generate',
      mode: 'notes',
      input: 'C4 q E4 q G4 h',
      prompt: 'Make it smoother with a small pause.',
    })

    expect(result.generatedInput).toBe('( C4 8, D4 8, E4 q ) pause q, G4 32, A4 32, B4 16, C5 8')
  })

  it('keeps the AI syntax guide aligned with supported notation tokens', () => {
    for (const token of [
      'w',
      'h',
      'q',
      '8',
      '16',
      '32',
      'R',
      'rest',
      'pause',
      'pp',
      'mp',
      'ff',
      'dolce',
      'staccato',
      'a-tempo',
      'cresc.',
      'decresc.',
      'diminuendo',
      'Csus',
      'Csus2',
      'Csus4',
      'Caug',
    ]) {
      expect(STAFFSMITH_AI_SYNTAX_GUIDE).toContain(token)
    }

    expect(STAFFSMITH_AI_SYNTAX_GUIDE).toContain('( C4 q, D4 q, E4 h )')
    expect(GEMINI_CONFIG.generationRules.join('\n')).toContain('durations w/h/q/8/16/32')
    expect(GEMINI_CONFIG.generationRules.join('\n')).toContain('notes and intentional rests/pauses')
  })
})
