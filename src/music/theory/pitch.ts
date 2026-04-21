import { Note } from 'tonal'
import type { NotePitch } from '../model/types'

export function parseScientificPitch(value: string): NotePitch | null {
  const parsed = Note.get(value)
  if (parsed.empty || parsed.oct === undefined || parsed.alt === undefined || parsed.letter === undefined) {
    return null
  }

  if (parsed.alt < -1 || parsed.alt > 1) {
    return null
  }

  return {
    step: parsed.letter as NotePitch['step'],
    alter: parsed.alt as -1 | 0 | 1,
    octave: parsed.oct,
    scientific: parsed.name,
  }
}

export function buildPitchClass(step: NotePitch['step'], alter: NotePitch['alter']): string {
  if (alter === 1) {
    return `${step}#`
  }

  if (alter === -1) {
    return `${step}b`
  }

  return step
}
