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
    id: 'notes-triad',
    label: 'Dynamic Triad',
    mode: 'notes',
    description: 'Simple note events with dynamics and expression text.',
    input: 'mf [dolce] C4 q, E4 q, G4 h',
  },
  {
    id: 'notes-bars',
    label: 'Hairpin Notes',
    mode: 'notes',
    description: 'Whitespace note entry with bar separators and volume changes.',
    input: 'p C4 E4 G4 | < F4 A4 C5 | > G4 h',
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
