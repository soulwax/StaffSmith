import { Music2, Play, SquareStack } from 'lucide-react'
import { SectionCard } from '../../components/SectionCard'
import type { InputMode, ParseError } from '../../music/model/types'
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

export function EditorPanel({
  examples,
  input,
  mode,
  errors,
  onDraftChange,
  onRender,
  onSelectExample,
}: EditorPanelProps) {
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

      <label className="visually-hidden" htmlFor="staffsmith-input">
        Source
      </label>
      <textarea
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
            ? 'C4 q, mf, <, >, slur(...), staccato'
            : 'Cmaj7 | Am7 | Dm7 G7 | Cmaj7'}
        </p>
      </div>
    </SectionCard>
  )
}
