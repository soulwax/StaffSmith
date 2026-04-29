import type { InputMode, Score } from './types'

export function createEmptyScore(mode: InputMode): Score {
  return {
    metadata: {
      title: 'StaffSmith Draft',
      mode,
      divisions: 8,
      beats: 4,
      beatType: 4,
      totalEvents: 0,
    },
    measures: [],
  }
}
