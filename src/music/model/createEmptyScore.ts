import type { InputMode, Score } from './types'

export function createEmptyScore(mode: InputMode, options: Partial<Pick<Score['metadata'], 'beats' | 'beatType'>> = {}): Score {
  return {
    metadata: {
      title: 'StaffSmith Draft',
      mode,
      divisions: 8,
      beats: options.beats ?? 4,
      beatType: options.beatType ?? 4,
      totalEvents: 0,
    },
    measures: [],
  }
}
