import { escapeXml } from '../../lib/text'
import { isRhythmicEvent, type ChordEvent, type DirectionEvent, type Measure, type NoteEvent, type Score, type ScoreEvent } from '../model/types'
import { DURATION_UNITS, MUSICXML_NOTE_TYPE } from '../theory/duration'
import { buildPitchClass } from '../theory/pitch'
import { DEFAULT_SHEET_OPTIONS, getClefDefinition, getDensityScale, type ScoreSheetOptions } from './sheetOptions'

const FULL_MEASURE_UNITS = 8

export function scoreToMusicXml(score: Score, options: Partial<ScoreSheetOptions> = {}): string {
  const sheetOptions = { ...DEFAULT_SHEET_OPTIONS, ...options }
  const measuresXml = score.measures
    .map((measure, index) => renderMeasure(measure, index === 0, sheetOptions))
    .join('\n')
  const title = sheetOptions.title || score.metadata.title
  const subtitle = sheetOptions.subtitle
  const creatorXml = sheetOptions.composer
    ? `    <creator type="composer">${escapeXml(sheetOptions.composer)}</creator>\n`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>${escapeXml(title)}</work-title>
  </work>
  <identification>
${creatorXml}    ${subtitle ? `<miscellaneous><miscellaneous-field name="subtitle">${escapeXml(subtitle)}</miscellaneous-field></miscellaneous>` : ''}
    <creator type="software">StaffSmith MVP</creator>
    <encoding>
      <software>StaffSmith</software>
    </encoding>
  </identification>
  <defaults>
    <scaling>
      <millimeters>7</millimeters>
      <tenths>${Math.round(40 / getDensityScale(sheetOptions.density))}</tenths>
    </scaling>
    <page-layout>
      <page-height>1683.78</page-height>
      <page-width>1190.55</page-width>
      <page-margins type="both">
        <left-margin>70</left-margin>
        <right-margin>70</right-margin>
        <top-margin>70</top-margin>
        <bottom-margin>70</bottom-margin>
      </page-margins>
    </page-layout>
  </defaults>
  <part-list>
    <score-part id="P1">
      <part-name>${escapeXml(sheetOptions.staffLabel || (score.metadata.mode === 'notes' ? 'Melody' : 'Lead Sheet'))}</part-name>
    </score-part>
  </part-list>
  <part id="P1">
${measuresXml}
  </part>
</score-partwise>`
}

function renderMeasure(measure: Measure, isFirst: boolean, options: ScoreSheetOptions): string {
  const contents = measure.events.map(renderEvent).join('\n')
  const measureUnits = measure.events
    .filter(isRhythmicEvent)
    .reduce((sum, event) => sum + DURATION_UNITS[event.duration], 0)
  const padding = options.padIncompleteMeasures && measureUnits < FULL_MEASURE_UNITS
    ? renderRestSequence(FULL_MEASURE_UNITS - measureUnits)
    : ''
  const clef = getClefDefinition(options.clef)
  const attributes = isFirst
    ? `    <attributes>
      <divisions>2</divisions>
      <key>
        <fifths>${options.keyFifths}</fifths>
      </key>
      <time>
        <beats>${options.beats}</beats>
        <beat-type>${options.beatType}</beat-type>
      </time>
      <clef>
        <sign>${clef.sign}</sign>
        <line>${clef.line}</line>
      </clef>
    </attributes>${options.showTempo ? `\n${renderTempo(options.tempoBpm)}` : ''}`
    : ''

  return `    <measure number="${measure.index + 1}">
${attributes}
${contents}${padding ? `\n${padding}` : ''}
    </measure>`
}

function renderTempo(tempoBpm: number): string {
  const tempo = Number.isFinite(tempoBpm) ? Math.max(20, Math.min(260, Math.round(tempoBpm))) : 96

  return `      <direction placement="above">
        <direction-type>
          <metronome parentheses="no">
            <beat-unit>quarter</beat-unit>
            <per-minute>${tempo}</per-minute>
          </metronome>
        </direction-type>
        <sound tempo="${tempo}" />
      </direction>`
}

function renderEvent(event: ScoreEvent): string {
  if (event.kind === 'note') {
    return renderNoteEvent(event)
  }

  if (event.kind === 'chord') {
    return renderChordEvent(event)
  }

  return renderDirectionEvent(event)
}

function renderNoteEvent(event: NoteEvent): string {
  return `      <note>
        <pitch>
          <step>${event.pitch.step}</step>
${event.pitch.alter !== 0 ? `          <alter>${event.pitch.alter}</alter>\n` : ''}          <octave>${event.pitch.octave}</octave>
        </pitch>
        <duration>${DURATION_UNITS[event.duration]}</duration>
        <type>${MUSICXML_NOTE_TYPE[event.duration]}</type>
      </note>`
}

function renderChordEvent(event: ChordEvent): string {
  return `      <harmony>
        <root>
          <root-step>${event.root.step}</root-step>
${event.root.alter !== 0 ? `          <root-alter>${event.root.alter}</root-alter>\n` : ''}        </root>
        <kind text="${escapeXml(event.symbol)}">${event.harmonyKind}</kind>
      </harmony>
      <note>
        <pitch>
          <step>${event.helperPitch.step}</step>
${event.helperPitch.alter !== 0 ? `          <alter>${event.helperPitch.alter}</alter>\n` : ''}          <octave>${event.helperPitch.octave}</octave>
        </pitch>
        <duration>${DURATION_UNITS[event.duration]}</duration>
        <type>${MUSICXML_NOTE_TYPE[event.duration]}</type>
        <lyric>
          <text>${escapeXml(buildPitchClass(event.root.step, event.root.alter))}</text>
        </lyric>
      </note>`
}

function renderDirectionEvent(event: DirectionEvent): string {
  if (event.directionKind === 'dynamic') {
    return `      <direction placement="below">
        <direction-type>
          <dynamics>
            <${event.text} />
          </dynamics>
        </direction-type>
      </direction>`
  }

  if (event.directionKind === 'hairpin') {
    const wedgeType = event.value ?? 'crescendo'

    return `      <direction placement="below">
        <direction-type>
          <wedge type="${wedgeType}" />
        </direction-type>
        <direction-type>
          <words>${escapeXml(event.text)}</words>
        </direction-type>
      </direction>`
  }

  return `      <direction placement="above">
        <direction-type>
          <words>${escapeXml(event.text)}</words>
        </direction-type>
      </direction>`
}

function renderRestSequence(units: number): string {
  const chunks = splitUnits(units)

  return chunks
    .map(
      (chunk) => `      <note>
        <rest />
        <duration>${chunk}</duration>
        <type>${MUSICXML_NOTE_TYPE[toDurationSymbol(chunk)]}</type>
      </note>`,
    )
    .join('\n')
}

function splitUnits(units: number): number[] {
  const values = [8, 4, 2, 1]
  const chunks: number[] = []
  let remaining = units

  for (const value of values) {
    while (remaining >= value) {
      chunks.push(value)
      remaining -= value
    }
  }

  return chunks
}

function toDurationSymbol(units: number) {
  if (units === 8) {
    return 'w'
  }

  if (units === 4) {
    return 'h'
  }

  if (units === 2) {
    return 'q'
  }

  return '8'
}
