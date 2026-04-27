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
      <header className="workspace-header">
        <div className="brand-lockup">
          <svg
            className="brand-mark"
            viewBox="0 0 32 32"
            aria-hidden="true"
            focusable="false"
          >
            <rect x="2" y="2" width="28" height="28" rx="9" />
            <path d="M10 22V10h2.4v12H10Zm4.8-6.8V10h2.4v5.2h4V10h2.4v12h-2.4v-4.8h-4V22h-2.4v-6.8Z" />
          </svg>
          <h1>Staffsmith</h1>
        </div>
        <div className="workspace-metrics" aria-label="Current score summary">
          <span>{state.mode === 'notes' ? 'Notes' : 'Chords'}</span>
          <span>{activeScore ? `${activeScore.measures.length} measures` : 'No score'}</span>
          <span>{activeScore ? `${activeScore.metadata.totalEvents} events` : summarizeErrors(errors)}</span>
        </div>
      </header>

      <main className="layout">
        <div className="workbench-column">
          <EditorPanel
            examples={EXAMPLES}
            initialInput={state.input}
            initialMode={state.mode}
            errors={errors}
            onRender={handleRender}
            onSelectExample={handleSelectExample}
          />

          <div className="inspector-grid">
            <SectionCard title="Status" tone={errors.length > 0 ? 'danger' : 'success'}>
              <p className="status-line">{summarizeErrors(errors)}</p>
              <p className="muted">Last render: {state.lastUpdated}</p>
              {activeScore ? (
                <dl className="score-stats">
                  <div>
                    <dt>Measures</dt>
                    <dd>{activeScore.measures.length}</dd>
                  </div>
                  <div>
                    <dt>Events</dt>
                    <dd>{activeScore.metadata.totalEvents}</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd>
                      {activeScore.metadata.beats}/{activeScore.metadata.beatType}
                    </dd>
                  </div>
                </dl>
              ) : null}
              {warnings.length > 0 ? (
                <ul className="compact-list">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </SectionCard>

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
        </div>

        <div className="preview-column">
          <ScorePreview musicXml={state.musicXml} />
        </div>
      </main>
    </div>
  )
}
