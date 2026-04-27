import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SaveProjectRequest } from '../src/lib/apiTypes'
import { handleError, methodNotAllowed, readJsonBody, sendJson } from './_lib/http'
import { listProjects, saveProject } from './_lib/db'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    if (request.method === 'GET') {
      const projects = await listProjects()
      sendJson(response, 200, { projects })
      return
    }

    if (request.method === 'POST') {
      const project = await saveProject(readJsonBody<SaveProjectRequest>(request))
      sendJson(response, 200, { project })
      return
    }

    methodNotAllowed(response, ['GET', 'POST'])
  } catch (error) {
    handleError(response, error)
  }
}
