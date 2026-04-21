import { useState } from 'react'
import './app.css'
import { SectionCard } from './components/SectionCard'
import { EditorPanel } from './features/editor/EditorPanel'
import { EXAMPLES } from './features/editor/examples'
import { ScorePreview } from './features/renderer/ScorePreview'
import type { InputMode, ParseError, ParseResult, Score } from './music/model/types'
import { scoreToMusicXml } from './music/musicxml/scoreToMusicXml'
import { parseScoreInput } from './music/parser'

type RenderState = {
  input: string
  mode: InputMode
  parseResult: ParseResult<Score>
  musicXml: string | null
  lastUpdated: string
}

function renderInput(mode: InputMode, input: string): RenderState {
  const parseResult = parseScoreInput(mode, input)
  const musicXml = parseResult.ok ? scoreToMusicXml(parseResult.value) : null

  return {
    input,
    mode,
    parseResult,
    musicXml,
    lastUpdated: new Date().toLocaleTimeString(),
  }
}

function summarizeErrors(errors: ParseError[]): string {
  if (errors.length === 0) {
    return 'Ready to render.'
  }

  return `${errors.length} parse error${errors.length === 1 ? '' : 's'} found.`
}

const initialExample = EXAMPLES[0] ?? {
  id: 'fallback',
  label: 'Fallback',
  mode: 'notes' as const,
  description: 'Fallback example.',
  input: 'C4 q, E4 q, G4 h',
}

export function App() {
  const [state, setState] = useState<RenderState>(() => renderInput(initialExample.mode, initialExample.input))

  const activeScore = state.parseResult.ok ? state.parseResult.value : null
  const warnings = state.parseResult.warnings
  const errors = state.parseResult.errors

  const handleRender = (mode: InputMode, input: string) => {
    setState(renderInput(mode, input))
  }

  const handleSelectExample = (exampleId: string) => {
    const example = EXAMPLES.find((entry) => entry.id === exampleId)
    if (!example) {
      return
    }

    setState(renderInput(example.mode, example.input))
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">StaffSmith</p>
          <h1>Turn note text and chord sketches into browser-rendered notation.</h1>
          <p className="hero-copy">
            Paste simple note sequences or chord progressions, normalize them into a score model,
            and preview MusicXML engraving locally in the browser.
          </p>
        </div>
        <SectionCard title="Status" tone={errors.length > 0 ? 'danger' : 'success'}>
          <p>{summarizeErrors(errors)}</p>
          <p className="muted">Last render attempt: {state.lastUpdated}</p>
          {activeScore ? (
            <ul className="compact-list">
              <li>{activeScore.measures.length} measure(s)</li>
              <li>{activeScore.metadata.mode === 'notes' ? 'Notes mode' : 'Chords mode'}</li>
              <li>{activeScore.metadata.totalEvents} event(s)</li>
            </ul>
          ) : null}
          {warnings.length > 0 ? (
            <>
              <h3>Warnings</h3>
              <ul className="compact-list">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </>
          ) : null}
        </SectionCard>
      </header>

      <main className="layout">
        <EditorPanel
          examples={EXAMPLES}
          initialInput={state.input}
          initialMode={state.mode}
          errors={errors}
          onRender={handleRender}
          onSelectExample={handleSelectExample}
        />

        <div className="right-column">
          <ScorePreview musicXml={state.musicXml} />

          <SectionCard title="Parse Details">
            {errors.length > 0 ? (
              <ul className="error-list">
                {errors.map((error) => (
                  <li key={`${error.index}-${error.message}`}>
                    <strong>
                      Line {error.line}, Col {error.column}
                    </strong>{' '}
                    {error.message}
                    {error.token ? <span className="muted"> Token: {error.token}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                Parsed successfully. StaffSmith generated canonical MusicXML ready for preview or
                future export features.
              </p>
            )}
          </SectionCard>
        </div>
      </main>
    </div>
  )
}
