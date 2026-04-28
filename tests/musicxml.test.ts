import { describe, expect, it } from 'vitest'
import { parseScoreInput } from '../src/music/parser'
import { scoreToMusicXml } from '../src/music/musicxml/scoreToMusicXml'

describe('MusicXML export', () => {
  it('emits A4 page settings, compact scaling, and no default staff label', () => {
    const result = parseScoreInput('notes', 'C4 q E4 q G4 h')
    expect(result.ok).toBe(true)

    const xml = scoreToMusicXml(result.value, {
      density: 'compact',
      staffLabel: '',
      title: 'Etude & Print',
      showTempo: true,
    })

    expect(xml).toContain('<work-title>Etude &amp; Print</work-title>')
    expect(xml).toContain('<page-height>1683.78</page-height>')
    expect(xml).toContain('<page-width>1190.55</page-width>')
    expect(xml).toContain('<tenths>51</tenths>')
    expect(xml).toContain('<part-name></part-name>')
    expect(xml).toContain('<per-minute>96</per-minute>')
  })

  it('serializes printable dynamics, expressions, and hairpins', () => {
    const result = parseScoreInput('notes', 'mf [warm tone] < C4 q D4 q > E4 h')
    expect(result.ok).toBe(true)

    const xml = scoreToMusicXml(result.value)

    expect(xml).toContain('<mf />')
    expect(xml).toContain('<words>warm tone</words>')
    expect(xml).toContain('<wedge type="crescendo" />')
    expect(xml).toContain('<wedge type="diminuendo" />')
  })
})
