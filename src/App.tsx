import { useState } from 'react'
import './app.css'
import { SectionCard } from './components/SectionCard'
import { EditorPanel } from './features/editor/EditorPanel'
import { EXAMPLES } from './features/editor/examples'
import { ScorePreview } from './features/renderer/ScorePreview'
import type {
  ApiErrorResponse,
  ComposerAssistResult,
  ProjectListResponse,
  SavedProject,
  SaveProjectRequest,
} from './lib/apiTypes'
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
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projects, setProjects] = useState<SavedProject[]>([])
  const [assistantPrompt, setAssistantPrompt] = useState('')
  const [analysis, setAnalysis] = useState<ComposerAssistResult | null>(null)
  const [isAssisting, setIsAssisting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [serverMessage, setServerMessage] = useState<string | null>(null)

  const activeScore = state.parseResult.ok ? state.parseResult.value : null
  const warnings = state.parseResult.warnings
  const errors = state.parseResult.errors

  const updateDraft = (mode: InputMode, input: string) => {
    setState(renderInput(mode, input))
    setServerMessage(null)
  }

  const handleRender = (mode: InputMode, input: string) => {
    setState(renderInput(mode, input))
  }

  const handleSelectExample = (exampleId: string) => {
    const example = EXAMPLES.find((entry) => entry.id === exampleId)
    if (!example) {
      return
    }

    updateDraft(example.mode, example.input)
  }

  const runAssist = async (task: 'analyze' | 'generate') => {
    setIsAssisting(true)
    setServerMessage(null)

    try {
      const response = await fetch('/api/composer-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          mode: state.mode,
          input: state.input,
          prompt: assistantPrompt,
        }),
      })

      const body = await response.json() as { result?: ComposerAssistResult } & ApiErrorResponse
      if (!response.ok || !body.result) {
        throw new Error(body.error || 'Composer assistant failed.')
      }

      setAnalysis(body.result)
      if (task === 'generate') {
        updateDraft(body.result.suggestedMode, body.result.generatedInput)
      }
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : 'Composer assistant failed.')
    } finally {
      setIsAssisting(false)
    }
  }

  const saveCurrentProject = async () => {
    setIsSaving(true)
    setServerMessage(null)

    try {
      const payload: SaveProjectRequest = {
        mode: state.mode,
        input: state.input,
        score: activeScore,
        musicXml: state.musicXml,
        analysis,
      }
      if (projectId) {
        payload.id = projectId
      }
      if (activeScore?.metadata.title) {
        payload.title = activeScore.metadata.title
      }

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const body = await response.json() as { project?: SavedProject } & ApiErrorResponse
      if (!response.ok || !body.project) {
        throw new Error(body.error || 'Project could not be saved.')
      }

      setProjectId(body.project.id)
      setProjects((current) => [body.project!, ...current.filter((project) => project.id !== body.project!.id)])
      setServerMessage('Project saved.')
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : 'Project could not be saved.')
    } finally {
      setIsSaving(false)
    }
  }

  const refreshProjects = async () => {
    setServerMessage(null)

    try {
      const response = await fetch('/api/projects')
      const body = await response.json() as ProjectListResponse & ApiErrorResponse
      if (!response.ok) {
        throw new Error(body.error || 'Projects could not be loaded.')
      }

      setProjects(body.projects)
      setServerMessage(body.projects.length > 0 ? 'Projects loaded.' : 'No saved projects yet.')
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : 'Projects could not be loaded.')
    }
  }

  const loadProject = (project: SavedProject) => {
    setProjectId(project.id)
    setAnalysis(project.analysis)
    updateDraft(project.mode, project.input)
    setServerMessage(`Loaded ${project.title}.`)
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
            input={state.input}
            mode={state.mode}
            errors={errors}
            onDraftChange={updateDraft}
            onRender={handleRender}
            onSelectExample={handleSelectExample}
          />

          <SectionCard title="Studio Intelligence">
            <label className="editor-label" htmlFor="assistant-prompt">
              Direction
            </label>
            <textarea
              id="assistant-prompt"
              className="assistant-textarea"
              rows={3}
              value={assistantPrompt}
              onChange={(event) => setAssistantPrompt(event.target.value)}
              placeholder="Ask for a folk-rock variation, a clearer key center, or a four-bar continuation."
            />
            <div className="studio-actions">
              <button type="button" className="secondary-button" onClick={() => runAssist('analyze')} disabled={isAssisting}>
                Analyze Key
              </button>
              <button type="button" className="secondary-button" onClick={() => runAssist('generate')} disabled={isAssisting}>
                Generate Idea
              </button>
              <button type="button" className="secondary-button" onClick={saveCurrentProject} disabled={isSaving}>
                Save Project
              </button>
              <button type="button" className="ghost-button" onClick={refreshProjects}>
                Load Recent
              </button>
            </div>
            {serverMessage ? <p className="server-message">{serverMessage}</p> : null}
            {analysis ? (
              <div className="analysis-panel">
                <p>
                  <strong>{analysis.keyCenter}</strong> {analysis.summary}
                </p>
                {analysis.notes.length > 0 ? (
                  <ul className="compact-list">
                    {analysis.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {projects.length > 0 ? (
              <div className="project-list" aria-label="Recent saved projects">
                {projects.map((project) => (
                  <button key={project.id} type="button" className="project-row" onClick={() => loadProject(project)}>
                    <span>{project.title}</span>
                    <span>{new Date(project.updatedAt).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </SectionCard>

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
