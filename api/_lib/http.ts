import type { VercelRequest, VercelResponse } from '@vercel/node'

export type HttpError = Error & {
  statusCode?: number
  details?: Record<string, unknown>
}

export function sendJson(response: VercelResponse, statusCode: number, body: unknown) {
  response.setHeader('Content-Type', 'application/json')
  response.status(statusCode).json(body)
}

export function methodNotAllowed(response: VercelResponse, allowedMethods: string[]) {
  response.setHeader('Allow', allowedMethods.join(', '))
  sendJson(response, 405, { error: 'Method not allowed.' })
}

export function readJsonBody<T>(request: VercelRequest): T {
  if (!request.body) {
    return {} as T
  }

  if (typeof request.body === 'string') {
    return JSON.parse(request.body) as T
  }

  return request.body as T
}

export function fail(statusCode: number, message: string, details?: Record<string, unknown>): never {
  const error = new Error(message) as HttpError
  error.statusCode = statusCode
  if (details) {
    error.details = details
  }
  throw error
}

export function handleError(response: VercelResponse, error: unknown) {
  const statusCode = typeof error === 'object' && error && 'statusCode' in error
    ? Number((error as HttpError).statusCode)
    : 500
  const message = error instanceof Error ? error.message : 'Unexpected server error.'
  const details = typeof error === 'object' && error && 'details' in error
    ? (error as HttpError).details
    : undefined

  sendJson(response, Number.isFinite(statusCode) ? statusCode : 500, {
    error: message,
    ...details,
  })
}
