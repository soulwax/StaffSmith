import { describe, expect, it } from 'vitest'
import { parseScoreInput } from '../src/music/parser'
import { scoreToMusicXml } from '../src/music/musicxml/scoreToMusicXml'
import { EXAMPLES } from '../src/features/editor/examples'

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
    expect(xml).toContain('<page-height>2424.49</page-height>')
    expect(xml).toContain('<page-width>1714.29</page-width>')
    expect(xml).toContain('<page-margins type="odd">')
    expect(xml).toContain('<left-margin>81.63</left-margin>')
    expect(xml).toContain('<right-margin>81.63</right-margin>')
    expect(xml).toContain('<top-margin>81.63</top-margin>')
    expect(xml).toContain('<system-distance>61.22</system-distance>')
    expect(xml).toContain('<music-font font-family="Bravura, Maestro, Petaluma, Finale Maestro" />')
    expect(xml).toContain('<millimeters>4.90</millimeters>')
    expect(xml).toContain('<tenths>40</tenths>')
    expect(xml).toContain('<divisions>8</divisions>')
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

  it('allows thirteen systems per page for the orchestral solo preset', () => {
    const input = Array.from({ length: 79 }, () => 'C4 w').join(' | ')
    const result = parseScoreInput('notes', input)
    expect(result.ok).toBe(true)

    const xml = scoreToMusicXml(result.value, {
      partLayoutPreset: 'orchestral-solo',
      staffLabel: '',
    })

    expect(xml).toContain('<measure number="79">\n      <print new-page="yes" />')
  })

  it('uses preset-specific page breaks for standard and children layouts', () => {
    const input = Array.from({ length: 37 }, () => 'C4 w').join(' | ')
    const result = parseScoreInput('notes', input)
    expect(result.ok).toBe(true)

    const standardXml = scoreToMusicXml(result.value, {
      partLayoutPreset: 'standard-part',
      staffLabel: '',
    })
    const childrenXml = scoreToMusicXml(result.value, {
      partLayoutPreset: 'children-songs',
      staffLabel: '',
    })

    expect(standardXml).toContain('<measure number="17">\n      <print new-page="yes" />')
    expect(childrenXml).toContain('<measure number="16">\n      <print new-page="yes" />')
    expect(childrenXml).toContain('<measure number="31">\n      <print new-page="yes" />')
  })

  it('serializes printable dynamics, expressions, and hairpin labels', () => {
    const result = parseScoreInput('notes', 'mf [warm tone] < C4 q D4 q > E4 h')
    expect(result.ok).toBe(true)

    const xml = scoreToMusicXml(result.value)

    expect(xml).toContain('<mf />')
    expect(xml).toContain('<words>warm tone</words>')
    expect(xml).toContain('<words font-style="italic">cresc.</words>')
    expect(xml).toContain('<words font-style="italic">dim.</words>')
    expect(xml).not.toContain('<wedge')
  })

  it('serializes the bundled composer solo example with OSMD-safe hairpin labels', () => {
    const example = EXAMPLES.find((preset) => preset.id === 'notes-woodwinds')
    expect(example).toBeDefined()

    const result = parseScoreInput('notes', example?.input ?? '')
    expect(result.ok).toBe(true)

    const xml = scoreToMusicXml(result.value)
    const hairpinLabels = xml.match(/<words font-style="italic">(?:cresc\.|dim\.)<\/words>/g) ?? []

    expect(result.value.measures).toHaveLength(32)
    expect(hairpinLabels.length).toBeGreaterThan(0)
    expect(xml).not.toContain('<wedge')
  })

  it('serializes fast durations, pauses, standard beat beaming, and slurs', () => {
    const result = parseScoreInput('notes', '( C4 8, D4 8, E4 q ) pause q, G4 32, A4 32, B4 16, C5 8')
    expect(result.ok).toBe(true)

    const xml = scoreToMusicXml(result.value)

    expect(xml).toContain('<type>32nd</type>')
    expect(xml).toContain('<type>16th</type>')
    expect(xml).toContain('<duration>1</duration>')
    expect(xml).toContain('<rest />')
    expect(xml).toContain('<beam number="3">begin</beam>')
    expect(xml).toContain('<slur type="start" number="1" />')
    expect(xml).toContain('<slur type="stop" number="1" />')
  })

  it('serializes explicit rests, page-turn breaks, and cue-sized notes for long silence', () => {
    const restRun = Array.from({ length: 13 }, () => 'R w').join(' | ')
    const opening = Array.from({ length: 24 }, () => 'C4 w').join(' | ')
    const result = parseScoreInput('notes', `${opening} | ${restRun} | D4 w`)
    expect(result.ok).toBe(true)

    const xml = scoreToMusicXml(result.value)

    expect(xml).toContain('<measure number="25">\n      <print new-page="yes" />')
    expect(xml).toContain('<rest measure="yes" />')
    expect(xml).toContain('<cue />')
    expect(xml).toContain('<notehead font-size="cue">normal</notehead>')
  })
})
