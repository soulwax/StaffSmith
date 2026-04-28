import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { GeminiStatusResponse } from '../src/lib/apiTypes.js'
import { checkGeminiAvailability } from './_lib/gemini.js'
import { methodNotAllowed, sendJson } from './_lib/http.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') {
    methodNotAllowed(response, ['GET'])
    return
  }

  try {
    sendJson(response, 200, await checkGeminiAvailability())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gemini status check failed.'
    const body: GeminiStatusResponse = {
      available: false,
      checkedAt: new Date().toISOString(),
      message,
      model: 'gemini-3.1-flash-lite-preview',
    }

    sendJson(response, 200, body)
  }
}
