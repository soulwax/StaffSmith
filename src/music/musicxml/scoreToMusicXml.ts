import { escapeXml } from '../../lib/text'
import type { ChordEvent, Measure, NoteEvent, Score, ScoreEvent } from '../model/types'
import { DURATION_UNITS, MUSICXML_NOTE_TYPE } from '../theory/duration'
import { buildPitchClass } from '../theory/pitch'

const FULL_MEASURE_UNITS = 8

export function scoreToMusicXml(score: Score): string {
  const measuresXml = score.measures.map((measure, index) => renderMeasure(measure, index === 0)).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>${escapeXml(score.metadata.title)}</work-title>
  </work>
  <identification>
    <creator type="software">StaffSmith MVP</creator>
    <encoding>
      <software>StaffSmith</software>
    </encoding>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>${score.metadata.mode === 'notes' ? 'Melody' : 'Lead Sheet'}</part-name>
    </score-part>
  </part-list>
  <part id="P1">
${measuresXml}
  </part>
</score-partwise>`
}

function renderMeasure(measure: Measure, isFirst: boolean): string {
  const contents = measure.events.map(renderEvent).join('\n')
  const measureUnits = measure.events.reduce((sum, event) => sum + DURATION_UNITS[event.duration], 0)
  const padding = measureUnits < FULL_MEASURE_UNITS ? renderRestSequence(FULL_MEASURE_UNITS - measureUnits) : ''
  const attributes = isFirst
    ? `    <attributes>
      <divisions>2</divisions>
      <key>
        <fifths>0</fifths>
      </key>
      <time>
        <beats>4</beats>
        <beat-type>4</beat-type>
      </time>
      <clef>
        <sign>G</sign>
        <line>2</line>
      </clef>
    </attributes>`
    : ''

  return `    <measure number="${measure.index + 1}">
${attributes}
${contents}${padding ? `\n${padding}` : ''}
    </measure>`
}

function renderEvent(event: ScoreEvent): string {
  return event.kind === 'note' ? renderNoteEvent(event) : renderChordEvent(event)
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
