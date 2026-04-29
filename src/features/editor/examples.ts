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
    id: 'notes-woodwinds',
    label: 'Single Notes',
    mode: 'notes',
    description: '32-bar D minor flute solo with theme, freestyle, return, middle, and cadenza sections.',
    input: 'mp [airy flute] ( D5 q, F5 q, A5 h ) | < G5 q, A5 q, B5 q, A5 q | > G5 q, F5 q, E5 q, D5 q | pause h, D5 h | mf [theme] D5 q, F5 q, A5 q, C6 q | ( B5 8, A5 8, G5 q, F5 q, E5 q ) | < F5 8, G5 8, A5 8, B5 8, C6 q, A5 q | > G5 q, F5 q, E5 q, D5 q | mp [freestyle] pause 8, D5 32, E5 32, F5 16, G5 q, A5 q, D5 q | ( A5 16, B5 16, C6 8, A5 8, G5 q, F5 q ) pause 8 | F#5 32, G5 32, A5 16, pause 8, B5 8, A5 8, G5 q, E5 q | < D5 8, F5 8, A5 8, C6 8, B5 q, A5 q | mf [return] D5 q, F5 q, A5 h | G5 q, A5 q, B5 q, A5 q | > G5 q, F5 q, E5 q, D5 q | p [middle] R q, D5 q, F5 q, G5 q | ( A5 8, C6 8, B5 q, A5 q, G5 q ) | F5 16, G5 16, A5 8, pause 8, E5 8, D5 q, F5 q | < G5 q, A5 q, C6 h | > B5 q, A5 q, G5 q, F5 q | [freestyle] D5 32, E5 32, F5 16, A5 8, G5 8, F5 q, E5 q, pause 8 | ( D5 q, F5 q, A5 q, D6 q ) | mp D5 q, F5 q, A5 q, F5 q | p [coda] C6 h, A5 q, D5 q | mp [finale] pause q, D5 8, F5 8, A5 q, C6 q | D6 16, C6 16, A5 8, G5 8, F5 8, E5 8, D5 q, pause 8 | < F5 q, A5 q, C6 q, D6 q | > C6 q, A5 q, G5 q, F5 q | [cadenza-like] D5 32, E5 32, F5 16, G5 16, A5 16, B5 8, A5 8, G5 q, F5 q | pause h, A5 8, G5 8, F5 q | p ( E5 q, F5 q, D5 h ) | pp D5 w',
  },
  {
    id: 'chords-turnaround',
    label: 'Chords',
    mode: 'chords',
    description: 'Lead-sheet harmony with dynamics and a hairpin.',
    input: 'mf Cmaj7 | < Am7 | Dm7 G7 | p Cmaj7',
  },
]
