import { Minus, Music2, Play, Plus, SquareStack } from 'lucide-react'
import { useRef, useState } from 'react'
import { SectionCard } from '../../components/SectionCard'
import type { DurationSymbol, InputMode, ParseError } from '../../music/model/types'
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
]
const DYNAMICS = ['pp', 'p', 'mp', 'mf', 'f', 'ff'] as const
const EXPRESSIONS = ['dolce', 'legato', 'staccato', 'tenuto'] as const
const CHORD_ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const
const CHORD_QUALITIES = [
  { label: 'maj', value: '' },
  { label: 'min', value: 'm' },
  { label: 'maj7', value: 'maj7' },
  { label: 'm7', value: 'm7' },
  { label: '7', value: '7' },
  { label: 'dim', value: 'dim' },
  { label: 'aug', value: 'aug' },
] as const
const CHORD_PROGRESSIONS = [
  { label: 'ii V I', value: 'Dm7 | G7 | Cmaj7' },
  { label: 'I vi ii V', value: 'Cmaj7 | Am7 | Dm7 | G7' },
  { label: '12-bar start', value: 'C7 | F7 | C7 | C7' },
] as const

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

  const insertToken = (token: string, nextMode = mode) => {
    const textarea = textareaRef.current
    if (!textarea) {
      onDraftChange(nextMode, joinToken(input, token, nextMode))
      return
    }

    const selectionStart = textarea.selectionStart
    const selectionEnd = textarea.selectionEnd
    const before = input.slice(0, selectionStart)
    const after = input.slice(selectionEnd)
    const nextBefore = joinToken(before, token, nextMode)
    const needsTrailingSpace = after.length > 0 && !/^\s/.test(after)
    const nextInput = `${nextBefore}${needsTrailingSpace ? ' ' : ''}${after}`
    const nextCursor = nextBefore.length + (needsTrailingSpace ? 1 : 0)

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
    insertToken(`${step}${accidental}${octave} ${duration}`, 'notes')
  }

  const insertRest = () => {
    insertToken(`R ${duration}`, 'notes')
  }

  const insertChord = () => {
    insertToken(`${chordRoot}${chordQuality}`, 'chords')
  }

  const changeOctave = (step: number) => {
    setOctave((current) => Math.max(1, Math.min(8, current + step)))
  }

  return (
    <SectionCard title="Composer" className="composer-card">
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
        {mode === 'notes' ? (
          <>
            <div className="builder-row builder-row--split">
              <div className="builder-group">
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
            </div>

            <div className="builder-row">
              <div className="builder-group">
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

            <div className="builder-row builder-row--split">
              <div className="builder-group">
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
                <button type="button" onClick={insertRest}>Rest</button>
                <button type="button" onClick={() => insertToken('|')}>Bar</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="builder-row builder-row--split">
              <div className="builder-group">
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

              <div className="builder-group">
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
            </div>

            <div className="builder-row builder-row--split">
              <div className="builder-group builder-group--tools">
                <span className="builder-label">Chord</span>
                <button type="button" onClick={insertChord}>{chordRoot}{chordQuality}</button>
                <button type="button" onClick={() => insertToken('|')}>Bar</button>
              </div>

              <div className="builder-group">
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

        <div className="builder-row builder-row--split">
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
            </div>
          </div>
        </div>
      </div>

      <label className="visually-hidden" htmlFor="staffsmith-input">
        Source
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
            ? 'C4 q, D4 q, E4 h'
            : 'Cmaj7 | Am7 | Dm7 G7 | Cmaj7'
        }
      />

      <div className="editor-actions">
        <button type="button" className="render-button" onClick={() => onRender(mode, input)}>
          <Play size={16} aria-hidden="true" />
          Render
        </button>
        <p className={errors.length > 0 ? 'helper-text helper-text--error' : 'helper-text'}>
          {mode === 'notes'
            ? 'C4 q, R h, mf, <, >, staccato'
            : 'Cmaj7 | Am7 | Dm7 G7 | Cmaj7'}
        </p>
      </div>
    </SectionCard>
  )
}
