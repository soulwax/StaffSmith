import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runComposerAssist } from '../api/_lib/gemini'
import { GEMINI_CONFIG } from '../api/_lib/gemini.config'
import { STAFFSMITH_AI_SYNTAX_GUIDE } from '../src/music/parser/syntaxGuide'

const originalGeminiKey = process.env.GEMINI_API_KEY

function mockGeminiJson(payload: unknown) {
  mockGeminiText(JSON.stringify(payload))
}

function mockGeminiText(text: string) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text,
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

function countMeasures(input: string) {
  return input.split('|').map((measure) => measure.trim()).filter(Boolean).length
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

  it('parses Gemini JSON when extra text appears after the JSON object', async () => {
    mockGeminiText(`${JSON.stringify({
      summary: 'Long-form flute sketch.',
      keyCenter: 'D minor',
      suggestedMode: 'notes',
      generatedInput: 'mp D5 q, F5 q, A5 h | < G5 q, A5 q, B5 q, A5 q',
      notes: ['Returned as JSON with trailing prose.'],
    })}
Extra commentary that should not break JSON parsing.`)

    const result = await runComposerAssist({
      task: 'generate',
      mode: 'notes',
      input: 'C4 q E4 q G4 h',
      prompt: 'A long beginner flute solo.',
    })

    expect(result.summary).toBe('Long-form flute sketch.')
    expect(result.generatedInput).toContain('mp D5 q')
  })

  it('expands explicit 100-measure requests when Gemini returns a shorter parseable idea', async () => {
    mockGeminiJson({
      summary: 'Short source idea for a requested long piece.',
      keyCenter: 'D minor',
      suggestedMode: 'notes',
      generatedInput: 'mp D5 q, F5 q, A5 h | < G5 q, A5 q, B5 q, A5 q',
      notes: ['Requested length is handled by StaffSmith.'],
    })

    const result = await runComposerAssist({
      task: 'generate',
      mode: 'notes',
      input: '',
      prompt: '"Take Five" Notes - slight variation - expected length: at least 100 4/4 measures',
    })

    expect(countMeasures(result.generatedInput)).toBe(100)
    expect(result.generatedInput).toContain('[return]')
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
    expect(result.generatedInput.split('|')).toHaveLength(32)
    expect(result.generatedInput).toContain('[freestyle]')
    expect(result.generatedInput).toContain('[finale]')
    expect(result.summary).toContain('local beginner flute fallback')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('expands the local fallback for unavailable long generation requests', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }))

    const result = await runComposerAssist({
      task: 'generate',
      mode: 'notes',
      input: '',
      prompt: 'Long airy flute solo, expected length: at least 100 4/4 measures',
    })

    expect(countMeasures(result.generatedInput)).toBe(100)
    expect(result.summary).toContain('local beginner flute fallback')
    expect(result.notes).toContain('Expanded locally to honor the requested long-form measure count.')
  })

  it('treats five-minute generation requests as long-form pieces', async () => {
    mockGeminiJson({
      summary: 'Short source idea for a five-minute request.',
      keyCenter: 'D minor',
      suggestedMode: 'notes',
      generatedInput: 'mp D5 q, F5 q, A5 h | < G5 q, A5 q, B5 q, A5 q',
      notes: [],
    })

    const result = await runComposerAssist({
      task: 'generate',
      mode: 'notes',
      input: '',
      prompt: 'Make it a 5-minute piece for orchestral solo flute.',
    })

    expect(countMeasures(result.generatedInput)).toBe(120)
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
    expect(GEMINI_CONFIG.generationRules.join('\n')).toContain('at least 24 measures')
    expect(GEMINI_CONFIG.generationRules.join('\n')).toContain('100-120 complete 4/4 measures')
    expect(GEMINI_CONFIG.generation.generate.maxOutputTokens).toBeGreaterThanOrEqual(32768)
    expect(GEMINI_CONFIG.generationRules.join('\n')).toContain('professionally engraved music')
  })
})
