import type { DirectionEvent } from '../model/types'

const DYNAMIC_MARKS = new Set(['pp', 'p', 'mp', 'mf', 'f', 'ff'])

const EXPRESSION_WORDS = new Map([
  ['dolce', 'dolce'],
  ['legato', 'legato'],
  ['staccato', 'staccato'],
  ['tenuto', 'tenuto'],
  ['cantabile', 'cantabile'],
  ['espressivo', 'espressivo'],
  ['rit', 'rit.'],
  ['rit.', 'rit.'],
  ['accel', 'accel.'],
  ['accel.', 'accel.'],
  ['a-tempo', 'a tempo'],
  ['tempo', 'a tempo'],
])

const CRESCENDO_WORDS = new Set(['<', 'cresc', 'cresc.', 'crescendo'])
const DIMINUENDO_WORDS = new Set(['>', 'dim', 'dim.', 'decresc', 'decresc.', 'diminuendo'])

export function parseDirectionToken(token: string, id: string): DirectionEvent | null {
  const normalized = token.trim()
  const lower = normalized.toLowerCase()

  if (DYNAMIC_MARKS.has(lower)) {
    return {
      id,
      kind: 'direction',
      directionKind: 'dynamic',
      text: lower,
    }
  }

  if (CRESCENDO_WORDS.has(lower)) {
    return {
      id,
      kind: 'direction',
      directionKind: 'hairpin',
      text: lower === '<' ? 'cresc.' : 'cresc.',
      value: 'crescendo',
    }
  }

  if (DIMINUENDO_WORDS.has(lower)) {
    return {
      id,
      kind: 'direction',
      directionKind: 'hairpin',
      text: lower === '>' ? 'dim.' : 'dim.',
      value: 'diminuendo',
    }
  }

  const expression = EXPRESSION_WORDS.get(lower)
  if (expression) {
    return {
      id,
      kind: 'direction',
      directionKind: 'expression',
      text: expression,
    }
  }

  if (normalized.startsWith('[') && normalized.endsWith(']') && normalized.length > 2) {
    return {
      id,
      kind: 'direction',
      directionKind: 'expression',
      text: normalized.slice(1, -1).replaceAll('_', ' '),
    }
  }

  return null
}
