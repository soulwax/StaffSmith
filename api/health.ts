import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEnv } from './_lib/env.js'
import { handleError, methodNotAllowed, sendJson } from './_lib/http.js'

export default function handler(request: VercelRequest, response: VercelResponse) {
  try {
    if (request.method !== 'GET') {
      methodNotAllowed(response, ['GET'])
      return
    }

    for (const name of ['GEMINI_API_KEY', 'DATABASE_URL', 'DATABASE_URL_UNPOOLED'] as const) {
      requireEnv(name)
    }

    sendJson(response, 200, {
      ok: true,
      services: {
        gemini: 'configured',
        database: 'configured',
      },
    })
  } catch (error) {
    handleError(response, error)
  }
}
