import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleError, methodNotAllowed, sendJson } from './_lib/http.js'

declare const process: {
  env: Partial<Record<'DATABASE_URL' | 'DATABASE_URL_UNPOOLED' | 'GEMINI_API_KEY', string>>
}

export default function handler(request: VercelRequest, response: VercelResponse) {
  try {
    if (request.method !== 'GET') {
      methodNotAllowed(response, ['GET'])
      return
    }

    sendJson(response, 200, {
      ok: true,
      services: {
        gemini: process.env.GEMINI_API_KEY ? 'configured' : 'missing',
        database: process.env.DATABASE_URL ? 'configured' : 'missing',
        databaseUnpooled: process.env.DATABASE_URL_UNPOOLED ? 'configured' : 'missing',
      },
    })
  } catch (error) {
    handleError(response, error)
  }
}
