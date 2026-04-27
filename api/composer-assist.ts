import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { ComposerAssistRequest } from '../src/lib/apiTypes'
import { runComposerAssist } from './_lib/gemini'
import { fail, handleError, methodNotAllowed, readJsonBody, sendJson } from './_lib/http'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    if (request.method !== 'POST') {
      methodNotAllowed(response, ['POST'])
      return
    }

    const payload = readJsonBody<ComposerAssistRequest>(request)
    if (payload.task !== 'analyze' && payload.task !== 'generate') {
      fail(400, 'Composer assist task must be analyze or generate.')
    }

    if (payload.mode !== 'notes' && payload.mode !== 'chords') {
      fail(400, 'Composer assist mode must be notes or chords.')
    }

    const result = await runComposerAssist(payload)
    sendJson(response, 200, { result })
  } catch (error) {
    handleError(response, error)
  }
}
