import { toLocation } from '../../lib/text'
import type { ParseError } from '../model/types'

export type Token = {
  value: string
  index: number
}

export function tokenize(input: string, expression: RegExp): Token[] {
  const tokens: Token[] = []

  for (const match of input.matchAll(expression)) {
    const value = match[0]
    const index = match.index ?? 0
    tokens.push({ value, index })
  }

  return tokens
}

export function createParseError(
  input: string,
  index: number,
  message: string,
  token?: string,
): ParseError {
  const location = toLocation(input, index)
  const error: ParseError = {
    message,
    index,
    line: location.line,
    column: location.column,
  }

  if (token !== undefined) {
    error.token = token
  }

  return error
}
