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
    id: 'notes-flute-phrase',
    label: 'Airy Flute Phrase',
    mode: 'notes',
    description: 'Four-bar D minor melody with hairpins, slurs, thirty-seconds, and a held final note.',
    input: 'mp [airy flute] ( D5 q, F5 q, A5 8, G5 16, A5 16, B5 q ) | < pause 8, D5 32, E5 32, F5 16, G5 q, A5 q, D5 q | > A5 q, G5 q, F5 q, E5 q | D5 w',
  },
  {
    id: 'notes-bars',
    label: 'Hairpin Notes',
    mode: 'notes',
    description: 'Whitespace note entry with bar separators, pauses, and volume changes.',
    input: 'p C4 E4 G4 R q | < F4 A4 pause h | > G4 h, R h',
  },
  {
    id: 'chords-turnaround',
    label: 'Jazz Turnaround',
    mode: 'chords',
    description: 'Lead-sheet style harmony symbols with dynamics.',
    input: 'mf Cmaj7 | < Am7 | Dm7 G7 | p Cmaj7',
  },
  {
    id: 'chords-color',
    label: 'Color Chords',
    mode: 'chords',
    description: 'Sharps, flats, and diminished harmony.',
    input: 'Bbmaj7 | Gm7 | C7 | F#dim',
  },
]
