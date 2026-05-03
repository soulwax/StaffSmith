export const NOTE_SYNTAX_EXAMPLES = [
  '@dur=q D5, F5, A5 h',
  'C4 q, E4 q, G4 h',
  'C4 h, pause h | R w | D4 w',
  'section intro { D5 q, F5 q, A5 h }',
  '@motif intro = ( D5 q, F5 q, A5 h ) use intro',
  'repeat 2 { D5 q, F5 q, A5 h }',
  '( C4 8, D4 8, E4 q ) pause q, G4 32, A4 32, B4 16, C5 8',
  'mf [dolce] C4 q, E4 q, G4 h',
  'pp [flutter] F#5 32, G5 32, A5 16, pause 8, ( Bb5 8, C6 8 )',
  'p C4 E4 G4 | < F4 A4 C5 | > G4 h',
  'C4 q, D4 q, E4 q, F4 q | G4 h, R h',
] as const

export const CHORD_SYNTAX_EXAMPLES = [
  '@mode=chords Cmaj7 | Am7 | Dm7 G7 | Cmaj7',
  'Cmaj7 | Am7 | Dm7 G7 | Cmaj7',
  'mf Cmaj7 | < Am7 | Dm7 G7 | p Cmaj7',
  'C | Cm | Cmaj7 | Cmin7 | C7 | Cm7',
  'Cdim | Caug | Csus4 | Cadd9 | F#dim | Bbmaj7',
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
  'a-tempo',
  'tempo',
  '[free text]',
] as const

export const HAIRPIN_TOKENS = ['<, cresc, cresc.', '>, dim, dim., decresc, decresc.'] as const

export const EXOTIC_EXPRESSION_EXAMPLES = ['[flutter]', '[sul pont.]', '[snap pizz.]', '[breathy]', '[glassy]'] as const

export const STAFFSMITH_AI_SYNTAX_GUIDE = `StaffScript v0.1 syntax guide:
- Return generatedInput as plain StaffScript notation only, never markdown.
- StaffScript is StaffSmith's official readable text notation language. Preferred extension: .staff.
- Optional metadata directives: @version=0.1, @title="Title", @composer="Name", @instrument=flute, @tempo=120, @time=4/4 or @time=5/4, @key=Dm, @mode=notes or @mode=chords, @dur=q.
- @dur sets the default duration for following notes/rests. Explicit durations override it.
- Prefer modern StaffScript v0.1 for generated pieces: use @mode, @key, @tempo, @dur where useful, formal section blocks, motifs, and repeat blocks instead of only flat bar-separated text.
- Be faithful to the requested music: preserve the requested mood, style traits, length, form, difficulty, and role while keeping the result original and parseable.
- If an instrument is mentioned, optimize for that instrument with idiomatic range, breathing/resonance needs, articulation, and phrase lengths.
- Generation priority order: 1) clear notes and intentional rests/pauses, 2) correct 4/4 rhythm, 3) expressive color such as slurs, dynamics, hairpins, and bracketed performance text.
- Notes and pauses must carry the composition. Do not rely on dynamics or words to compensate for weak note choices.
- Full-piece requests should become real multi-section pieces, not tiny sketches. Prefer formal section blocks like section intro { ... }; bracketed section labels like [intro] remain valid.
- For a complete solo or beginning-to-end composition, aim for at least 24 measures unless the user asks for something short; 48-96 measures is acceptable when the prompt invites a long piece.
- If the user says "up to" a very large note count, treat that as permission to write generously within the response budget.
- Long output should still feel professionally engraved: clear 4- or 8-measure phrase groups, readable breath pauses, section changes, clean 4/4 beat grouping, and fast passages placed where a player can understand them.
- Avoid walls of unbroken short notes. Use 16/32-note writing for featured freestyle segments, ornaments, pickups, transitions, and climactic phrase peaks.
- Notes mode uses pitch+octave and optional duration: C4 q, F#3 h, Bb5 8, G5 16, A5 32.
- R, rest, or pause creates an explicit rest/pause and can take a duration: R w, rest q, pause 8.
- Notes require octave numbers. Valid durations are w, h, q, 8, 16, 32. Omitted durations default to q.
- Duration beat values: w=4 beats, h=2 beats, q=1 beat, 8=0.5 beats, 16=0.25 beats, 32=0.125 beats.
- Use short values musically: 16 and 32 are for quick gestures, pickups, flourishes, ornaments, and nervous motion, not for random clutter.
- Serious notation expectation: short durations should line up inside clean 4/4 beat groups; count every beat before returning generatedInput.
- Slurs for smooth/bowed transitions use spaced parentheses around notes: ( C4 q, D4 q, E4 h ). Never attach slurs to rests.
- Notes, rests, directions, and chord symbols may be separated by spaces or commas.
- CRITICAL: Each measure between | bars must total EXACTLY 4 beats — never more, never less.
- Use | as a real barline. Insert it immediately when the next note/rest would overflow 4 beats or when a measure is complete.
- Do not leave a measure incomplete unless the user specifically asks for a pickup or sketch fragment.
- Use explicit rests/pauses to complete silent beats instead of omitting rhythm: R q, pause h, R w.
- Example of INVALID measure (5 beats): D5 8, F5 8, A5 8, F5 8, G5 8, E5 8, D5 h (6×0.5+2=5). Split it.
- Example of VALID replacement: D5 8, F5 8, A5 8, F5 8, G5 8, A5 8 | D5 h, G5 h
- Count beats before writing each measure. If the measure would overflow, insert a | and continue.
- Dynamics may appear before notes or chords: ${DYNAMIC_TOKENS.join(', ')}.
- Expressions may appear before notes or chords: ${EXPRESSION_TOKENS.join(', ')}.
- Hairpins / volume changes: <, cresc, or cresc. for louder; >, dim, dim., decresc, decresc., or diminuendo for quieter.
- Custom expression text may be bracketed, for example [dolce] or [warmly].
- Motifs: @motif intro = ( D5 q, F5 q, A5 h ) then use intro. Compact aliases are allowed, e.g. @intro = ( D5 q, F5 q, A5 h ).
- Repeat blocks: repeat 2 { D5 q, F5 q, A5 h } or x2 { D5 q, F5 q, A5 h }.
- Exotic but supported color should use normal StaffSmith syntax: chromatic accidentals, wider octave shapes, 16/32-note figures, pauses, slurs, and bracketed text such as ${EXOTIC_EXPRESSION_EXAMPLES.join(', ')}.
- Chords mode uses lead-sheet symbols with optional sharp/flat roots: C, Cm, Cmin7, Cmaj7, Am7, D7, F#dim, Bbmaj7, Caug, Csus, Csus2, Csus4, Cadd9.
- If the active mode is chords, generate chord-mode StaffScript only, preferably with @mode=chords and section blocks; do not output note pitches, note durations, rests, or slur parentheses.
- Chord mode supports up to four chord symbols per measure.
- Chord mode also accepts dynamics, expressions, bracketed custom text, and hairpin tokens before chord symbols.
- Common chord-builder patterns include ii V I: Dm7 | G7 | Cmaj7, I vi ii V: Cmaj7 | Am7 | Dm7 | G7, and minor i VI VII: Am | F | G | Am.
- Notes examples: ${NOTE_SYNTAX_EXAMPLES.join(' ; ')}.
- Chord examples: ${CHORD_SYNTAX_EXAMPLES.join(' ; ')}.`
