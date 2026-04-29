import { escapeXml } from '../../lib/text'
import {
  isRhythmicEvent,
  type ChordEvent,
  type DirectionEvent,
  type Measure,
  type NoteEvent,
  type NotePitch,
  type RestEvent,
  type Score,
  type ScoreEvent,
} from '../model/types'
import { DURATION_UNITS, FULL_MEASURE_UNITS, MUSICXML_NOTE_TYPE } from '../theory/duration'
import { buildPitchClass } from '../theory/pitch'
import { DEFAULT_SHEET_OPTIONS, getClefDefinition, getDensityScale, getPartLayoutPreset, type ScoreSheetOptions } from './sheetOptions'

const STAFF_HEIGHT_TENTHS = 40
const ORCHESTRAL_SOLO_STAFF_MM = 4.9
const LONG_SILENCE_CUE_THRESHOLD = 12
const MIN_PAGE_TURN_REST_MEASURES = 4

type BeamMark = 'begin' | 'continue' | 'end'

type PageSize = {
  widthMm: number
  heightMm: number
}

type MeasureLayoutPlan = {
  newSystem: boolean
  newPage: boolean
  cuePitch?: NotePitch
}

const PAGE_SIZES: Record<ScoreSheetOptions['pageFormat'], PageSize> = {
  a4: { widthMm: 210, heightMm: 297 },
  'nine-by-twelve': { widthMm: 228.6, heightMm: 304.8 },
}

function computeBeams(events: ScoreEvent[]): Map<string, BeamMark> {
  const beams = new Map<string, BeamMark>()
  let run: string[] = []

  const flush = () => {
    if (run.length >= 2) {
      beams.set(run[0]!, 'begin')
      for (let i = 1; i < run.length - 1; i++) {
        beams.set(run[i]!, 'continue')
      }
      beams.set(run[run.length - 1]!, 'end')
    }
    run = []
  }

  for (const event of events) {
    if (!isRhythmicEvent(event)) {
      continue
    }
    if (event.kind !== 'note') {
      flush()
      continue
    }
    if (event.duration === '8' || event.duration === '16') {
      run.push(event.id)
    } else {
      flush()
    }
  }
  flush()
  return beams
}

function stemDirection(octave: number): 'up' | 'down' {
  // Treble clef middle line is B4. C5 and above → stem down; B4 and below → stem up.
  return octave >= 5 ? 'down' : 'up'
}

export function scoreToMusicXml(score: Score, options: Partial<ScoreSheetOptions> = {}): string {
  const sheetOptions = resolveSheetOptions(options)
  const layoutPlan = buildLayoutPlan(score, sheetOptions)
  const pageLayout = renderPageLayout(sheetOptions)
  const systemLayout = renderSystemLayout(sheetOptions)
  const measuresXml = score.measures
    .map((measure, index) => renderMeasure(measure, index === 0, sheetOptions, layoutPlan.get(index)))
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
      <millimeters>${formatDecimal(getStaffHeightMm(sheetOptions))}</millimeters>
      <tenths>${Math.round(40 / getDensityScale(sheetOptions.density))}</tenths>
    </scaling>
    <music-font font-family="Bravura, Maestro, Petaluma, Finale Maestro" />
    <word-font font-family="Times New Roman, Times, serif" font-size="10" />
${pageLayout}
${systemLayout}
  </defaults>
  <part-list>
    <score-part id="P1">
      <part-name>${escapeXml(sheetOptions.staffLabel)}</part-name>
    </score-part>
  </part-list>
  <part id="P1">
${measuresXml}
  </part>
</score-partwise>`
}

function resolveSheetOptions(options: Partial<ScoreSheetOptions>): ScoreSheetOptions {
  const baseOptions = { ...DEFAULT_SHEET_OPTIONS, ...options }
  const preset = getPartLayoutPreset(baseOptions.partLayoutPreset)

  return {
    ...baseOptions,
    density: options.density ?? preset.density,
    measuresPerSystem: options.measuresPerSystem ?? preset.measuresPerSystem,
    systemsPerPageTarget: options.systemsPerPageTarget ?? preset.systemsPerPageTarget,
    minimumSystemGapMm: options.minimumSystemGapMm ?? preset.minimumSystemGapMm,
    insideMarginMm: options.insideMarginMm ?? preset.insideMarginMm ?? baseOptions.insideMarginMm,
    outsideMarginMm: options.outsideMarginMm ?? preset.outsideMarginMm ?? baseOptions.outsideMarginMm,
    topMarginMm: options.topMarginMm ?? preset.topMarginMm ?? baseOptions.topMarginMm,
    bottomMarginMm: options.bottomMarginMm ?? preset.bottomMarginMm ?? baseOptions.bottomMarginMm,
  }
}

function buildLayoutPlan(score: Score, options: ScoreSheetOptions): Map<number, MeasureLayoutPlan> {
  const plan = new Map<number, MeasureLayoutPlan>()
  const measuresPerSystem = clampInteger(options.measuresPerSystem, 1, 12)
  const systemsPerPage = clampInteger(options.systemsPerPageTarget, 8, 12)
  const measuresPerPage = measuresPerSystem * systemsPerPage
  const pageBreaks = computePageBreaks(score, measuresPerPage)
  const cueMeasures = computeCueMeasures(score)

  score.measures.forEach((_, index) => {
    const newSystem = index > 0 && index % measuresPerSystem === 0
    const newPage = pageBreaks.has(index)
    const cuePitch = cueMeasures.get(index)

    if (newSystem || newPage || cuePitch) {
      plan.set(index, {
        newSystem: newPage ? false : newSystem,
        newPage,
        ...(cuePitch ? { cuePitch } : {}),
      })
    }
  })

  return plan
}

function computePageBreaks(score: Score, measuresPerPage: number): Set<number> {
  const breaks = new Set<number>()
  let target = measuresPerPage
  let previousBreak = 0

  while (target < score.measures.length) {
    const restBreak = findRestPageBreak(score, target, previousBreak)
    const sectionBreak = restBreak ?? findSectionPageBreak(score, target, previousBreak)
    const nextBreak = sectionBreak ?? target

    if (nextBreak <= previousBreak || nextBreak >= score.measures.length) {
      break
    }

    breaks.add(nextBreak)
    previousBreak = nextBreak
    target = previousBreak + measuresPerPage
  }

  return breaks
}

function findRestPageBreak(score: Score, target: number, previousBreak: number): number | undefined {
  const searchStart = Math.max(previousBreak + 1, target - MIN_PAGE_TURN_REST_MEASURES)
  const searchEnd = Math.min(score.measures.length - 1, target + MIN_PAGE_TURN_REST_MEASURES * 2)
  const runs = findFullMeasureRestRuns(score)

  return runs
    .map((run) => run.start)
    .filter((start) => start >= searchStart && start <= searchEnd)
    .sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0]
}

function findSectionPageBreak(score: Score, target: number, previousBreak: number): number | undefined {
  const searchStart = Math.max(previousBreak + 1, target - 2)
  const searchEnd = Math.min(score.measures.length - 1, target + 8)

  for (let index = searchStart; index <= searchEnd; index += 1) {
    if (hasSectionChange(score.measures[index])) {
      return index
    }
  }

  return undefined
}

function computeCueMeasures(score: Score): Map<number, NotePitch> {
  const cueMeasures = new Map<number, NotePitch>()
  const runs = findFullMeasureRestRuns(score)

  for (const run of runs) {
    if (run.length <= LONG_SILENCE_CUE_THRESHOLD) {
      continue
    }

    const cuePitch = findCuePitch(score, run.start + run.length)
    if (cuePitch) {
      cueMeasures.set(run.start, cuePitch)
    }
  }

  return cueMeasures
}

function findFullMeasureRestRuns(score: Score): Array<{ start: number, length: number }> {
  const runs: Array<{ start: number, length: number }> = []
  let runStart: number | null = null
  let runLength = 0

  score.measures.forEach((measure, index) => {
    if (isFullMeasureRest(measure)) {
      if (runStart === null) {
        runStart = index
      }
      runLength += 1
      return
    }

    if (runStart !== null) {
      runs.push({ start: runStart, length: runLength })
      runStart = null
      runLength = 0
    }
  })

  if (runStart !== null) {
    runs.push({ start: runStart, length: runLength })
  }

  return runs.filter((run) => run.length >= MIN_PAGE_TURN_REST_MEASURES)
}

function isFullMeasureRest(measure: Measure): boolean {
  const rhythmicEvents = measure.events.filter(isRhythmicEvent)

  return rhythmicEvents.length > 0
    && rhythmicEvents.every((event) => event.kind === 'rest')
    && rhythmicEvents.reduce((sum, event) => sum + DURATION_UNITS[event.duration], 0) === FULL_MEASURE_UNITS
}

function hasSectionChange(measure: Measure | undefined): boolean {
  if (!measure) {
    return false
  }

  return measure.events.some((event) => (
    event.kind === 'direction'
    && event.directionKind === 'expression'
    && /^(intro|verse|chorus|bridge|solo|trio|coda|rehearsal|section|[a-z])(?:\d+)?$/i.test(event.text.trim())
  ))
}

function findCuePitch(score: Score, startIndex: number): NotePitch | undefined {
  for (let index = startIndex; index < score.measures.length; index += 1) {
    for (const event of score.measures[index]?.events ?? []) {
      if (event.kind === 'note') {
        return event.pitch
      }

      if (event.kind === 'chord') {
        return event.helperPitch
      }
    }
  }

  return undefined
}

function renderPageLayout(options: ScoreSheetOptions): string {
  const pageSize = PAGE_SIZES[options.pageFormat]
  const tenthsPerMm = getTenthsPerMm(options)
  const inside = toTenths(options.insideMarginMm, tenthsPerMm)
  const outside = toTenths(options.outsideMarginMm, tenthsPerMm)
  const top = toTenths(options.topMarginMm, tenthsPerMm)
  const bottom = toTenths(options.bottomMarginMm, tenthsPerMm)

  return `    <page-layout>
      <page-height>${toTenths(pageSize.heightMm, tenthsPerMm)}</page-height>
      <page-width>${toTenths(pageSize.widthMm, tenthsPerMm)}</page-width>
      <page-margins type="odd">
        <left-margin>${inside}</left-margin>
        <right-margin>${outside}</right-margin>
        <top-margin>${top}</top-margin>
        <bottom-margin>${bottom}</bottom-margin>
      </page-margins>
      <page-margins type="even">
        <left-margin>${outside}</left-margin>
        <right-margin>${inside}</right-margin>
        <top-margin>${top}</top-margin>
        <bottom-margin>${bottom}</bottom-margin>
      </page-margins>
    </page-layout>`
}

function renderSystemLayout(options: ScoreSheetOptions): string {
  const tenthsPerMm = getTenthsPerMm(options)
  const minimumDistance = options.minimumSystemGapMm * tenthsPerMm
  const systemDistance = Math.max(minimumDistance, options.minimumSystemGapMm * 2.5 * tenthsPerMm)
  const topSystemDistance = toTenths(8, tenthsPerMm)

  return `    <system-layout>
      <system-margins>
        <left-margin>0</left-margin>
        <right-margin>0</right-margin>
      </system-margins>
      <system-distance>${formatDecimal(systemDistance)}</system-distance>
      <top-system-distance>${topSystemDistance}</top-system-distance>
    </system-layout>`
}

function renderPrint(layout: MeasureLayoutPlan | undefined): string {
  if (!layout?.newPage && !layout?.newSystem) {
    return ''
  }

  if (layout.newPage) {
    return '      <print new-page="yes" />'
  }

  return '      <print new-system="yes" />'
}

function renderCueOverlay(pitch: NotePitch): string {
  return `      <note>
        <cue />
        <pitch>
          <step>${pitch.step}</step>
${pitch.alter !== 0 ? `          <alter>${pitch.alter}</alter>\n` : ''}          <octave>${pitch.octave}</octave>
        </pitch>
        <duration>${DURATION_UNITS.q}</duration>
        <voice>2</voice>
        <type>quarter</type>
        <stem>${stemDirection(pitch.octave)}</stem>
        <notehead font-size="cue">normal</notehead>
      </note>
      <backup>
        <duration>${DURATION_UNITS.q}</duration>
      </backup>`
}

function getTenthsPerMm(options: ScoreSheetOptions): number {
  return Math.round(STAFF_HEIGHT_TENTHS / getDensityScale(options.density)) / getStaffHeightMm(options)
}

function getStaffHeightMm(options: ScoreSheetOptions): number {
  return options.partLayoutPreset === 'orchestral-solo' ? ORCHESTRAL_SOLO_STAFF_MM : 7
}

function toTenths(valueMm: number, tenthsPerMm: number): string {
  return formatDecimal(valueMm * tenthsPerMm)
}

function formatDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.max(min, Math.min(max, Math.round(value)))
}

function renderMeasure(
  measure: Measure,
  isFirst: boolean,
  options: ScoreSheetOptions,
  layout?: MeasureLayoutPlan,
): string {
  const beams = computeBeams(measure.events)
  const print = renderPrint(layout)
  const cueOverlay = layout?.cuePitch ? renderCueOverlay(layout.cuePitch) : ''
  const contents = measure.events.map((event) => renderEvent(event, beams)).join('\n')
  const measureUnits = measure.events
    .filter(isRhythmicEvent)
    .reduce((sum, event) => sum + DURATION_UNITS[event.duration], 0)
  const padding = options.padIncompleteMeasures && measureUnits < FULL_MEASURE_UNITS
    ? renderRestSequence(FULL_MEASURE_UNITS - measureUnits)
    : ''
  const clef = getClefDefinition(options.clef)
  const attributes = isFirst
    ? `    <attributes>
      <divisions>4</divisions>
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
${print}
${attributes}
${cueOverlay}
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

function renderEvent(event: ScoreEvent, beams: Map<string, BeamMark>): string {
  if (event.kind === 'note') {
    return renderNoteEvent(event, beams.get(event.id))
  }

  if (event.kind === 'rest') {
    return renderRestEvent(event)
  }

  if (event.kind === 'chord') {
    return renderChordEvent(event)
  }

  return renderDirectionEvent(event)
}

function renderNoteEvent(event: NoteEvent, beamMark: BeamMark | undefined): string {
  const stem = event.duration === 'w' ? '' : `\n        <stem>${stemDirection(event.pitch.octave)}</stem>`
  const beam = renderBeam(event, beamMark)
  const notations = renderNoteNotations(event)
  return `      <note>
        <pitch>
          <step>${event.pitch.step}</step>
${event.pitch.alter !== 0 ? `          <alter>${event.pitch.alter}</alter>\n` : ''}          <octave>${event.pitch.octave}</octave>
        </pitch>
        <duration>${DURATION_UNITS[event.duration]}</duration>
        <voice>1</voice>
        <type>${MUSICXML_NOTE_TYPE[event.duration]}</type>${stem}${beam}${notations}
      </note>`
}

function renderBeam(event: NoteEvent, beamMark: BeamMark | undefined): string {
  if (!beamMark) {
    return ''
  }

  const secondaryBeam = event.duration === '16'
    ? `\n        <beam number="2">${beamMark}</beam>`
    : ''

  return `\n        <beam number="1">${beamMark}</beam>${secondaryBeam}`
}

function renderNoteNotations(event: NoteEvent): string {
  if (!event.slurStart && !event.slurStop) {
    return ''
  }

  const slurs = [
    event.slurStop ? '          <slur type="stop" number="1" />' : '',
    event.slurStart ? '          <slur type="start" number="1" />' : '',
  ].filter(Boolean).join('\n')

  return `\n        <notations>\n${slurs}\n        </notations>`
}

function renderRestEvent(event: RestEvent): string {
  const measureRest = event.duration === 'w' ? ' measure="yes"' : ''

  return `      <note>
        <rest${measureRest} />
        <duration>${DURATION_UNITS[event.duration]}</duration>
        <voice>1</voice>
        <type>${MUSICXML_NOTE_TYPE[event.duration]}</type>
      </note>`
}

function renderChordEvent(event: ChordEvent): string {
  const stem = event.duration === 'w' ? '' : `\n        <stem>${stemDirection(event.helperPitch.octave)}</stem>`
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
        <voice>1</voice>
        <type>${MUSICXML_NOTE_TYPE[event.duration]}</type>${stem}
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
        <voice>1</voice>
        <type>${MUSICXML_NOTE_TYPE[toDurationSymbol(chunk)]}</type>
      </note>`,
    )
    .join('\n')
}

function splitUnits(units: number): number[] {
  const values = [16, 8, 4, 2, 1]
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
  if (units === 16) {
    return 'w'
  }

  if (units === 8) {
    return 'h'
  }

  if (units === 4) {
    return 'q'
  }

  if (units === 2) {
    return '8'
  }

  return '16'
}
