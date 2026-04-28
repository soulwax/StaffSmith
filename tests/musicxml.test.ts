import { describe, expect, it } from 'vitest'
import { parseScoreInput } from '../src/music/parser'
import { scoreToMusicXml } from '../src/music/musicxml/scoreToMusicXml'

describe('MusicXML export', () => {
  it('emits compact orchestral solo page settings, 30% smaller scaling, and no default staff label', () => {
    const result = parseScoreInput('notes', 'C4 q E4 q G4 h')
    expect(result.ok).toBe(true)

    const xml = scoreToMusicXml(result.value, {
      partLayoutPreset: 'orchestral-solo',
      staffLabel: '',
      title: 'Etude & Print',
      showTempo: true,
    })

    expect(xml).toContain('<work-title>Etude &amp; Print</work-title>')
    expect(xml).toContain('<page-height>1697.14</page-height>')
    expect(xml).toContain('<page-width>1200</page-width>')
    expect(xml).toContain('<page-margins type="odd">')
    expect(xml).toContain('<left-margin>85.71</left-margin>')
    expect(xml).toContain('<right-margin>57.14</right-margin>')
    expect(xml).toContain('<system-distance>57.14</system-distance>')
    expect(xml).toContain('<music-font font-family="Bravura, Maestro, Petaluma, Finale Maestro" />')
    expect(xml).toContain('<millimeters>4.9</millimeters>')
    expect(xml).toContain('<tenths>40</tenths>')
    expect(xml).toContain('<part-name></part-name>')
    expect(xml).toContain('<per-minute>96</per-minute>')
  })

  it('uses denser line breaks for the orchestral solo preset', () => {
    const input = Array.from({ length: 7 }, () => 'C4 w').join(' | ')
    const result = parseScoreInput('notes', input)
    expect(result.ok).toBe(true)

    const xml = scoreToMusicXml(result.value, {
      partLayoutPreset: 'orchestral-solo',
      staffLabel: '',
    })

    expect(xml).toContain('<measure number="7">\n      <print new-system="yes" />')
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

  it('serializes explicit rests, page-turn breaks, and cue-sized notes for long silence', () => {
    const restRun = Array.from({ length: 13 }, () => 'R w').join(' | ')
    const opening = Array.from({ length: 36 }, () => 'C4 w').join(' | ')
    const result = parseScoreInput('notes', `${opening} | ${restRun} | D4 w`)
    expect(result.ok).toBe(true)

    const xml = scoreToMusicXml(result.value)

    expect(xml).toContain('<measure number="37">\n      <print new-page="yes" />')
    expect(xml).toContain('<rest measure="yes" />')
    expect(xml).toContain('<cue />')
    expect(xml).toContain('<notehead font-size="cue">normal</notehead>')
  })
})
