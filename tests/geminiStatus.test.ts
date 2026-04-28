import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkGeminiAvailability } from '../api/_lib/gemini'

const originalGeminiKey = process.env.GEMINI_API_KEY

describe('Gemini availability check', () => {
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

  it('reports available when the model metadata endpoint accepts the key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

    const status = await checkGeminiAvailability()

    expect(status).toMatchObject({
      available: true,
      message: 'Gemini available.',
      model: 'gemini-2.5-flash',
    })
    expect(status.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(status.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('reports unavailable when Gemini rejects the configured key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 403 }))

    const status = await checkGeminiAvailability()

    expect(status).toMatchObject({
      available: false,
      message: 'Gemini key rejected.',
      model: 'gemini-2.5-flash',
    })
  })
})
