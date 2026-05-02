import { Minus, Music2, Play, Plus, SquareStack } from 'lucide-react'
import { useRef, useState } from 'react'
import { SectionCard } from '../../components/SectionCard'
import type { DurationSymbol, InputMode, ParseError } from '../../music/model/types'
import { DURATION_UNITS, FULL_MEASURE_UNITS, isDurationSymbol } from '../../music/theory/duration'
import type { ExamplePreset } from './examples'
import './EditorPanel.css'

type EditorPanelProps = {
  examples: ExamplePreset[]
  input: string
  mode: InputMode
  errors: ParseError[]
  onDraftChange: (mode: InputMode, input: string) => void
  onRender: (mode: InputMode, input: string) => void
  onSelectExample: (exampleId: string) => void
}

const NOTE_STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const ACCIDENTALS = [
  { label: 'Natural', value: '' },
  { label: 'Sharp', value: '#' },
  { label: 'Flat', value: 'b' },
] as const
const DURATIONS: Array<{ label: string, value: DurationSymbol }> = [
  { label: 'Whole', value: 'w' },
  { label: 'Half', value: 'h' },
  { label: 'Quarter', value: 'q' },
  { label: 'Eighth', value: '8' },
  { label: '16th', value: '16' },
  { label: '32nd', value: '32' },
]
const DYNAMICS = ['pp', 'p', 'mp', 'mf', 'f', 'ff'] as const
const EXPRESSIONS = ['dolce', 'legato', 'staccato', 'tenuto', 'cantabile', 'espressivo', 'rit.', 'accel.'] as const
const REST_FILL_DURATIONS: DurationSymbol[] = ['w', 'h', 'q', '8', '16', '32']
const STAFFSCRIPT_SNIPPETS = [
  { label: 'Header', value: '@version=0.1\n@title="Take Five - 1st Flute"\n@instrument=flute\n@tempo=120\n@time=4/4\n@key=Dm\n@dur=q\n\n' },
  { label: 'Section', value: 'section theme {\n  D5 q, F5 q, A5 h\n}' },
  { label: 'Motif', value: '@motif call = ( D5 q, F5 q, A5 h )' },
  { label: 'Use motif', value: 'use call' },
  { label: 'Repeat', value: 'repeat 2 {\n  D5 q, F5 q, A5 h\n}' },
  { label: 'Airy', value: '[airy flute]' },
] as const
const CHORD_ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const
const CHORD_QUALITIES = [
  { label: 'maj', value: '' },
  { label: 'min', value: 'm' },
  { label: 'maj7', value: 'maj7' },
  { label: 'm7', value: 'm7' },
  { label: '7', value: '7' },
  { label: 'dim', value: 'dim' },
  { label: 'aug', value: 'aug' },
  { label: 'sus2', value: 'sus2' },
  { label: 'sus4', value: 'sus4' },
] as const
const CHORD_PROGRESSIONS = [
  { label: 'ii V I', value: 'Dm7 | G7 | Cmaj7' },
  { label: 'I vi ii V', value: 'Cmaj7 | Am7 | Dm7 | G7' },
  { label: '12-bar start', value: 'C7 | F7 | C7 | C7' },
  { label: 'minor i VI VII', value: 'Am | F | G | Am' },
] as const
const RHYTHM_TOKEN_PATTERN = /,|\(|\)|[A-Ga-g](?:#|b)?\d+|[Rr](?:est)?|pause|w|h|q|8|16|32|\S+/gi
const TEMPO_RE = /^@tempo=(\d+).*$/im

function parseBpmFromInput(input: string): number | null {
  const match = input.match(TEMPO_RE)
  if (!match) {
    return null
  }
  const parsed = parseInt(match[1] ?? '', 10)
  return Number.isFinite(parsed) ? Math.max(20, Math.min(300, parsed)) : null
}

function setBpmInInput(input: string, bpm: number): string {
  const match = input.match(TEMPO_RE)
  if (match) {
    return input.replace(TEMPO_RE, `@tempo=${bpm}`)
  }

  return `@tempo=${bpm}${input ? `\n${input}` : ''}`
}

function joinToken(input: string, token: string, mode: InputMode) {
  const trimmedToken = token.trim()
  if (!trimmedToken) {
    return input
  }

  const trimmedInput = input.trimEnd()
  if (!trimmedInput) {
    return trimmedToken
  }

  if (trimmedToken.startsWith('|')) {
    return `${trimmedInput} ${trimmedToken}`
  }

  const separator = mode === 'notes' && !trimmedInput.endsWith('|') && !trimmedInput.endsWith(',')
    ? ', '
    : ' '

  return `${trimmedInput}${separator}${trimmedToken}`.trimStart()
}

function isDurationToken(value: string): value is DurationSymbol {
  return isDurationSymbol(value)
}

function getCurrentMeasureUnits(input: string) {
  const currentMeasure = input.split('|').at(-1) ?? ''
  const tokens = currentMeasure.match(RHYTHM_TOKEN_PATTERN) ?? []
  let units = 0

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? ''
    const isPitch = /^[A-Ga-g](?:#|b)?\d+$/.test(token)
    const isRest = /^r(?:est)?$/i.test(token) || /^pause$/i.test(token)
    if (!isPitch && !isRest) {
      continue
    }

    const maybeDuration = tokens[index + 1]
    if (maybeDuration && isDurationToken(maybeDuration)) {
      units += DURATION_UNITS[maybeDuration]
      index += 1
    } else {
      units += DURATION_UNITS.q
    }
  }

  return units
}

function makeSmartRhythmToken(input: string, token: string, duration: DurationSymbol, hasTrailingSource: boolean) {
  const currentUnits = getCurrentMeasureUnits(input)
  const tokenUnits = DURATION_UNITS[duration]
  const needsLeadingBar = currentUnits > 0 && currentUnits + tokenUnits > FULL_MEASURE_UNITS
  const nextUnits = needsLeadingBar ? tokenUnits : currentUnits + tokenUnits
  const needsClosingBar = !hasTrailingSource && nextUnits === FULL_MEASURE_UNITS

  return `${needsLeadingBar ? '| ' : ''}${token}${needsClosingBar ? ' |' : ''}`
}

function makeMeasureFillToken(input: string) {
  const currentUnits = getCurrentMeasureUnits(input)
  if (currentUnits <= 0 || currentUnits >= FULL_MEASURE_UNITS) {
    return '|'
  }

  let remainingUnits = FULL_MEASURE_UNITS - currentUnits
  const rests: string[] = []

  for (const duration of REST_FILL_DURATIONS) {
    const durationUnits = DURATION_UNITS[duration]
    while (remainingUnits >= durationUnits) {
      rests.push(`R ${duration}`)
      remainingUnits -= durationUnits
    }
  }

  return `${rests.join(', ')} |`
}

export function EditorPanel({
  examples,
  input,
  mode,
  errors,
  onDraftChange,
  onRender,
  onSelectExample,
}: EditorPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [duration, setDuration] = useState<DurationSymbol>('q')
  const [octave, setOctave] = useState(4)
  const [accidental, setAccidental] = useState<(typeof ACCIDENTALS)[number]['value']>('')
  const [chordRoot, setChordRoot] = useState<(typeof CHORD_ROOTS)[number]>('C')
  const [chordQuality, setChordQuality] = useState<(typeof CHORD_QUALITIES)[number]['value']>('maj7')

  const insertToken = (token: string, nextMode = mode, smartRhythm?: { duration: DurationSymbol }) => {
    const textarea = textareaRef.current
    if (!textarea) {
      const smartToken = smartRhythm ? makeSmartRhythmToken(input, token, smartRhythm.duration, false) : token
      onDraftChange(nextMode, joinToken(input, smartToken, nextMode))
      return
    }

    const selectionStart = textarea.selectionStart
    const selectionEnd = textarea.selectionEnd
    const before = input.slice(0, selectionStart)
    const after = input.slice(selectionEnd)
    const smartToken = smartRhythm ? makeSmartRhythmToken(before, token, smartRhythm.duration, after.trim().length > 0) : token
    const nextBefore = joinToken(before, smartToken, nextMode)
    const needsTrailingSpace = after.length > 0 && !/^\s/.test(after)
    const nextInput = `${nextBefore}${needsTrailingSpace ? ' ' : ''}${after}`
    const nextCursor = nextBefore.length + (needsTrailingSpace ? 1 : 0)

    onDraftChange(nextMode, nextInput)
    window.requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(nextCursor, nextCursor)
    })
  }

  const insertSnippet = (snippet: string, nextMode = mode) => {
    const textarea = textareaRef.current
    if (!textarea) {
      onDraftChange(nextMode, joinToken(input, snippet, nextMode))
      return
    }

    const selectionStart = textarea.selectionStart
    const selectionEnd = textarea.selectionEnd
    const before = input.slice(0, selectionStart)
    const after = input.slice(selectionEnd)
    const needsLeadingBreak = before.trim().length > 0 && !/[\s|{]\s*$/.test(before) && snippet.includes('\n')
    const needsTrailingBreak = after.trim().length > 0 && snippet.includes('\n') && !/^\s/.test(after)
    const insertion = `${needsLeadingBreak ? '\n' : ''}${snippet}${needsTrailingBreak ? '\n' : ''}`
    const nextInput = `${before}${insertion}${after}`
    const nextCursor = before.length + insertion.length

    onDraftChange(nextMode, nextInput)
    window.requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(nextCursor, nextCursor)
    })
  }

  const handleSelectExample = (exampleId: string) => {
    const example = examples.find((entry) => entry.id === exampleId)
    if (example) {
      onDraftChange(example.mode, example.input)
    }

    onSelectExample(exampleId)
  }

  const handleModeChange = (nextMode: InputMode) => {
    onDraftChange(nextMode, input)
  }

  const handleInputChange = (nextInput: string) => {
    onDraftChange(mode, nextInput)
  }

  const insertNote = (step: (typeof NOTE_STEPS)[number]) => {
    insertToken(`${step}${accidental}${octave} ${duration}`, 'notes', { duration })
  }

  const insertRest = () => {
    insertToken(`R ${duration}`, 'notes', { duration })
  }

  const insertMeasureFill = () => {
    const textarea = textareaRef.current
    const source = textarea ? input.slice(0, textarea.selectionStart) : input
    insertToken(makeMeasureFillToken(source), 'notes')
  }

  const insertChord = () => {
    insertToken(`${chordRoot}${chordQuality}`, 'chords')
  }

  const changeOctave = (step: number) => {
    setOctave((current) => Math.max(1, Math.min(8, current + step)))
  }

  const parsedBpm = parseBpmFromInput(input)
  const bpm = parsedBpm ?? 96

  const changeBpm = (step: number) => {
    const next = Math.max(20, Math.min(300, bpm + step))
    onDraftChange(mode, setBpmInInput(input, next))
  }

  return (
    <SectionCard title="StaffScript Composer" className="composer-card">
      <div className="mode-toggle" role="tablist" aria-label="Input mode">
        {(['notes', 'chords'] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            className={entry === mode ? 'mode-toggle__button is-active' : 'mode-toggle__button'}
            onClick={() => handleModeChange(entry)}
          >
            {entry === 'notes' ? <Music2 size={15} aria-hidden="true" /> : <SquareStack size={15} aria-hidden="true" />}
            {entry === 'notes' ? 'Notes' : 'Chords'}
          </button>
        ))}
      </div>

      <div className="examples">
        {examples.map((example) => (
          <button
            key={example.id}
            type="button"
            className="example-chip"
            onClick={() => handleSelectExample(example.id)}
            title={example.description}
          >
            {example.label}
          </button>
        ))}
      </div>

      <div className="editor-builder" aria-label="Notation builder">
        <div className="builder-row">
          <div className="builder-group builder-group--staffscript">
            <span className="builder-label">StaffScript</span>
            <div className="staffscript-snippet-strip">
              {STAFFSCRIPT_SNIPPETS.map((snippet) => (
                <button key={snippet.label} type="button" onClick={() => insertSnippet(snippet.value, 'notes')}>
                  {snippet.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {mode === 'notes' ? (
          <>
            <div className="builder-row builder-row--note-console">
              <div className="builder-group builder-group--duration">
                <span className="builder-label">Duration</span>
                <div className="builder-segmented" role="group" aria-label="Note duration">
                  {DURATIONS.map((entry) => (
                    <button
                      key={entry.value}
                      type="button"
                      className={duration === entry.value ? 'is-active' : undefined}
                      onClick={() => setDuration(entry.value)}
                      aria-pressed={duration === entry.value}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="builder-group builder-group--octave">
                <span className="builder-label">Octave</span>
                <button type="button" className="builder-icon-button" onClick={() => changeOctave(-1)} aria-label="Lower octave">
                  <Minus size={14} aria-hidden="true" />
                </button>
                <strong>{octave}</strong>
                <button type="button" className="builder-icon-button" onClick={() => changeOctave(1)} aria-label="Raise octave">
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>

              <div className="builder-group builder-group--accidental">
                <span className="builder-label">Accidental</span>
                <div className="builder-segmented" role="group" aria-label="Accidental">
                  {ACCIDENTALS.map((entry) => (
                    <button
                      key={entry.label}
                      type="button"
                      className={accidental === entry.value ? 'is-active' : undefined}
                      onClick={() => setAccidental(entry.value)}
                      aria-pressed={accidental === entry.value}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="builder-group builder-group--tools">
                <span className="builder-label">Measure</span>
                <button type="button" onClick={insertRest}>Pause</button>
                <button type="button" onClick={insertMeasureFill}>Fill 4/4</button>
                <button type="button" onClick={() => insertToken('|')}>Bar</button>
              </div>
            </div>

            <div className="builder-row">
              <div className="builder-group builder-group--pitch">
                <span className="builder-label">Pitch</span>
                <div className="pitch-grid" role="group" aria-label="Insert note">
                  {NOTE_STEPS.map((step) => (
                    <button key={step} type="button" onClick={() => insertNote(step)}>
                      {step}{accidental}{octave}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="builder-row builder-row--chord-console">
              <div className="builder-group builder-group--roots">
                <span className="builder-label">Root</span>
                <div className="chord-root-grid" role="group" aria-label="Chord root">
                  {CHORD_ROOTS.map((root) => (
                    <button
                      key={root}
                      type="button"
                      className={root === chordRoot ? 'is-active' : undefined}
                      onClick={() => setChordRoot(root)}
                      aria-pressed={root === chordRoot}
                    >
                      {root}
                    </button>
                  ))}
                </div>
              </div>

              <div className="builder-group builder-group--quality">
                <span className="builder-label">Quality</span>
                <div className="quality-grid" role="group" aria-label="Chord quality">
                  {CHORD_QUALITIES.map((quality) => (
                    <button
                      key={quality.label}
                      type="button"
                      className={quality.value === chordQuality ? 'is-active' : undefined}
                      onClick={() => setChordQuality(quality.value)}
                      aria-pressed={quality.value === chordQuality}
                    >
                      {quality.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="builder-group builder-group--tools">
                <span className="builder-label">Chord</span>
                <button type="button" onClick={insertChord}>{chordRoot}{chordQuality}</button>
                <button type="button" onClick={() => insertToken('|')}>Bar</button>
              </div>
            </div>

            <div className="builder-row">
              <div className="builder-group builder-group--progression">
                <span className="builder-label">Progression</span>
                <div className="progression-strip">
                  {CHORD_PROGRESSIONS.map((progression) => (
                    <button key={progression.label} type="button" onClick={() => insertToken(progression.value, 'chords')}>
                      {progression.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        <div className="builder-row builder-row--expression-console">
          <div className="builder-group">
            <span className="builder-label">Dynamics</span>
            <div className="token-strip" role="group" aria-label="Dynamics">
              {DYNAMICS.map((dynamic) => (
                <button key={dynamic} type="button" onClick={() => insertToken(dynamic)}>
                  {dynamic}
                </button>
              ))}
            </div>
          </div>

          <div className="builder-group">
            <span className="builder-label">Expression</span>
            <div className="token-strip" role="group" aria-label="Expression">
              {EXPRESSIONS.map((expression) => (
                <button key={expression} type="button" onClick={() => insertToken(expression)}>
                  {expression}
                </button>
              ))}
              <button type="button" onClick={() => insertToken('<')}>cresc</button>
              <button type="button" onClick={() => insertToken('>')}>dim</button>
              <button type="button" onClick={() => insertToken('(')}>slur start</button>
              <button type="button" onClick={() => insertToken(')')}>slur end</button>
            </div>
          </div>

          <div className="builder-group builder-group--tempo">
            <span className="builder-label">Tempo</span>
            <button type="button" className="builder-icon-button" onClick={() => changeBpm(-4)} aria-label="Slower">
              <Minus size={14} aria-hidden="true" />
            </button>
            <strong className={parsedBpm === null ? 'builder-bpm builder-bpm--default' : 'builder-bpm'}>
              {bpm}
            </strong>
            <button type="button" className="builder-icon-button" onClick={() => changeBpm(4)} aria-label="Faster">
              <Plus size={14} aria-hidden="true" />
            </button>
            <span className="builder-bpm-unit">BPM</span>
          </div>
        </div>
      </div>

      <label className="visually-hidden" htmlFor="staffsmith-input">
        StaffScript source
      </label>
      <textarea
        ref={textareaRef}
        id="staffsmith-input"
        className="editor-textarea"
        rows={12}
        value={input}
        onChange={(event) => handleInputChange(event.target.value)}
        placeholder={
          mode === 'notes'
            ? '@dur=q\nC4, D4, E4 h'
            : '@mode=chords\nCmaj7 | Am7 | Dm7 G7 | Cmaj7'
        }
      />

      <div className="editor-actions">
        <button type="button" className="render-button" onClick={() => onRender(mode, input)}>
          <Play size={16} aria-hidden="true" />
          Render
        </button>
        <p className={errors.length > 0 ? 'helper-text helper-text--error' : 'helper-text'}>
          {mode === 'notes'
            ? 'StaffScript: notes, rests, sections, motifs, repeats, @dur, @time'
            : 'StaffScript chords: C, Cm, Cmaj7, Cadd9, F#dim, Bbmaj7'}
        </p>
      </div>
    </SectionCard>
  )
}
