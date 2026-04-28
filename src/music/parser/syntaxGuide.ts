export const NOTE_SYNTAX_EXAMPLES = [
  'C4 q, E4 q, G4 h',
  'mf [dolce] C4 q, E4 q, G4 h',
  'p C4 E4 G4 | < F4 A4 C5 | > G4 h',
] as const

export const CHORD_SYNTAX_EXAMPLES = [
  'Cmaj7 | Am7 | Dm7 G7 | Cmaj7',
  'mf Cmaj7 | < Am7 | Dm7 G7 | p Cmaj7',
] as const

export const DYNAMIC_TOKENS = ['pp', 'p', 'mp', 'mf', 'f', 'ff'] as const

export const EXPRESSION_TOKENS = [
  'dolce',
  'legato',
  'staccato',
  'tenuto',
  'cantabile',
  'espressivo',
  'rit.',
  'accel.',
  '[free text]',
] as const

export const HAIRPIN_TOKENS = ['< or cresc', '> or dim'] as const

export const STAFFSMITH_AI_SYNTAX_GUIDE = `StaffSmith syntax guide:
- Return generatedInput as plain StaffSmith notation only, never markdown.
- Notes mode uses pitch+octave and optional duration: C4 q, F#3 h, Bb5 8.
- Notes require octave numbers. Valid durations are w, h, q, 8. Omitted durations default to q.
- Duration beat values: w=4 beats, h=2 beats, q=1 beat, 8=0.5 beats.
- CRITICAL: Each measure between | bars must total EXACTLY 4 beats — never more, never less.
- Example of INVALID measure (5 beats): D5 8, F5 8, A5 8, F5 8, G5 8, E5 8, D5 h (6×0.5+2=5). Split it.
- Example of VALID replacement: D5 8, F5 8, A5 8, F5 8, G5 8, A5 8 | D5 h, G5 h
- Count beats before writing each measure. If the measure would overflow, insert a | and continue.
- Dynamics may appear before notes or chords: ${DYNAMIC_TOKENS.join(', ')}.
- Expressions may appear before notes or chords: ${EXPRESSION_TOKENS.join(', ')}.
- Hairpins / volume changes: < or cresc for louder, > or dim for quieter.
- Custom expression text may be bracketed, for example [dolce] or [warmly].
- Chords mode uses lead-sheet symbols: C, Cm, Cmaj7, Am7, D7, F#dim, Bbmaj7.
- Chord mode supports up to four chord symbols per measure.
- Notes examples: ${NOTE_SYNTAX_EXAMPLES.join(' ; ')}.
- Chord examples: ${CHORD_SYNTAX_EXAMPLES.join(' ; ')}.`
