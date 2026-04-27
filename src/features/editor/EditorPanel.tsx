import { useState } from 'react'
import { SectionCard } from '../../components/SectionCard'
import type { InputMode, ParseError } from '../../music/model/types'
import type { ExamplePreset } from './examples'
import './EditorPanel.css'

type EditorPanelProps = {
  examples: ExamplePreset[]
  initialInput: string
  initialMode: InputMode
  errors: ParseError[]
  onRender: (mode: InputMode, input: string) => void
  onSelectExample: (exampleId: string) => void
}

export function EditorPanel({
  examples,
  initialInput,
  initialMode,
  errors,
  onRender,
  onSelectExample,
}: EditorPanelProps) {
  const [mode, setMode] = useState<InputMode>(initialMode)
  const [input, setInput] = useState(initialInput)

  const handleSelectExample = (exampleId: string) => {
    const example = examples.find((entry) => entry.id === exampleId)
    if (example) {
      setMode(example.mode)
      setInput(example.input)
    }

    onSelectExample(exampleId)
  }

  return (
    <SectionCard title="Composer Input">
      <div className="mode-toggle" role="tablist" aria-label="Input mode">
        {(['notes', 'chords'] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            className={entry === mode ? 'mode-toggle__button is-active' : 'mode-toggle__button'}
            onClick={() => setMode(entry)}
          >
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

      <label className="editor-label" htmlFor="staffsmith-input">
        Source input
      </label>
      <textarea
        id="staffsmith-input"
        className="editor-textarea"
        rows={12}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder={
          mode === 'notes'
            ? 'C4 q, D4 q, E4 h'
            : 'Cmaj7 | Am7 | Dm7 G7 | Cmaj7'
        }
      />

      <div className="editor-actions">
        <button type="button" className="render-button" onClick={() => onRender(mode, input)}>
          Render Score
        </button>
        <p className={errors.length > 0 ? 'helper-text helper-text--error' : 'helper-text'}>
          {mode === 'notes'
            ? 'Notes mode accepts note+octave with optional durations: w, h, q, 8.'
            : 'Chords mode accepts one to four chord symbols per measure.'}
        </p>
      </div>
    </SectionCard>
  )
}
