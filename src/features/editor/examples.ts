import type { InputMode } from '../../music/model/types'

export type ExamplePreset = {
  id: string
  label: string
  mode: InputMode
  description: string
  input: string
}

export const EXAMPLES: ExamplePreset[] = [
  {
    id: 'basic-notes',
    label: 'Basic Notes',
    mode: 'notes',
    description: 'StaffScript notes with rests, slurs, dynamics, and bar lines.',
    input: 'C4 q, E4 q, G4 h | C4 h, pause h | R w | mf [dolce] ( C4 8, D4 8, E4 q ), G4 q, A4 q',
  },
  {
    id: 'chords',
    label: 'Chords',
    mode: 'chords',
    description: 'Lead-sheet harmony with supported StaffScript chord symbols.',
    input: '@mode=chords\nmf Cmaj7 | < Am7 | Dm7 G7 | p Cmaj7 | C | Cm | Cmin7 | C7 | Cm7 | Cdim | Caug | Csus4 | Cadd9 | F#dim | Bbmaj7',
  },
  {
    id: 'staffscript-take-5-flute',
    label: 'StaffScript: Take 5 Flute Sketch',
    mode: 'notes',
    description: 'Metadata, 5/4 time, default duration, motifs, sections, repeats, dynamics, and expressions.',
    input: '@version=0.1\n@title="Take 5 for the Flute"\n@instrument=flute\n@tempo=120\n@time=5/4\n@dur=q\n\n@motif intro = ( D5, F5, A5 h )\n@motif fall = > G5, F5, E5, D5\n@motif rise = < G5, A5, B5, A5\n\nsection intro {\n  mp [intro] use intro | use rise | use fall | pause h, D5 h, R q\n}\n\nsection theme {\n  mf [theme] D5, F5, A5, C6, D6 |\n  ( B5 8, A5 8, G5, F5, E5 ), R q |\n  < F5 8, G5 8, A5 8, B5 8, C6, A5, R q |\n  use fall, R q\n}\n\nsection coda {\n  p ( E5, F5, D5 h ), R q |\n  pp D5 w, R q\n}\n\nrepeat 2 {\n  use intro |\n  use theme\n}\n\nuse coda',
  },
  {
    id: 'motifs-and-repeats',
    label: 'Motifs and Repeats',
    mode: 'notes',
    description: 'Reusable StaffScript phrases expanded with repeat blocks.',
    input: '@dur=8\n@motif call = ( D5, F5, A5 q )\n@answer = G5, F5, E5, D5 q\n\nx2 {\n  use call | use answer\n}\n\nrepeat 2 {\n  mp [echo] use call | p pause q, D5 q\n}',
  },
  {
    id: 'sections-and-expressions',
    label: 'Sections and Expressions',
    mode: 'notes',
    description: 'Formal sections with built-in and bracketed performance text.',
    input: '@title="Sections and Expressions"\n@tempo=92\n@dur=q\n\nsection intro {\n  mp dolce D5, F5, A5 h\n}\n\nsection theme {\n  mf cantabile ( A5 8, B5 8, C6, B5, A5 ) | staccato G5, F5, E5, D5\n}\n\nsection coda {\n  rit. p [breathy] E5, F5, D5 h | pp D5 w\n}',
  },
]
