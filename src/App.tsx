import { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  CircleHelp,
  Copy,
  Download,
  FilePlus2,
  FolderOpen,
  Gauge,
  LayoutDashboard,
  LoaderCircle,
  Music2,
  PanelRightClose,
  PanelRightOpen,
  Ruler,
  Save,
  ScrollText,
  Search,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import './app.css'
import { SectionCard } from './components/SectionCard'
import { ChangelogPage } from './features/changelog/ChangelogPage'
import { EditorPanel } from './features/editor/EditorPanel'
import { EXAMPLES } from './features/editor/examples'
import { SyntaxHelp } from './features/help/SyntaxHelp'
import { ScorePreview } from './features/renderer/ScorePreview'
import type {
  ApiErrorResponse,
  ComposerAssistResult,
  GeminiStatusResponse,
  ProjectListResponse,
  SavedProject,
  SaveProjectRequest,
} from './lib/apiTypes'
import { copyText, downloadTextFile, toSafeFilename } from './lib/fileActions'
import { getScoreInsights } from './music/analysis/scoreInsights'
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

type LocalDraft = {
  projectId: string | null
  projectTitle: string
  mode: InputMode
  input: string
  assistantPrompt: string
  noteGenerationPrompt: string
  analysis: ComposerAssistResult | null
}

const AUTOSAVE_KEY = 'staffsmith:draft:v2'
const DEFAULT_NOTE_GENERATION_PROMPT = 'A flute solo for beginners, in the style of jethro tull jazz'
const API_TIMEOUT_MS = 45_000
const API_PREFLIGHT_TIMEOUT_MS = 3_000
const GEMINI_STATUS_INTERVAL_MS = 60 * 60 * 1000

type GeminiUiStatus = GeminiStatusResponse & {
  state: 'checking' | 'available' | 'unavailable'
}

type AppView = 'workspace' | 'help' | 'changelog'

function getCurrentView(): AppView {
  if (window.location.hash === '#/help') {
    return 'help'
  }

  if (window.location.hash === '#/changelog') {
    return 'changelog'
  }

  return 'workspace'
}

function renderInput(mode: InputMode, input: string, title = 'Untitled sketch'): RenderState {
  const parseResult = parseScoreInput(mode, input)
  const musicXml = parseResult.ok
    ? scoreToMusicXml(parseResult.value, {
      title,
      staffLabel: '',
      density: 'compact',
      showTempo: true,
    })
    : null

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

async function fetchJson<T>(url: string, init: RequestInit, fallbackMessage: string): Promise<T> {
  if (url.startsWith('/api/') && url !== '/api/health') {
    await assertApiAvailable(fallbackMessage)
  }

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    })
    const contentType = response.headers.get('content-type') ?? ''

    if (!contentType.includes('application/json')) {
      throw new Error(`${fallbackMessage} API is not returning JSON. In local development, run pnpm dev:full so Vercel API routes are available.`)
    }

    const body = await response.json() as T & ApiErrorResponse
    if (!response.ok) {
      throw new Error(getApiErrorMessage(body, fallbackMessage))
    }

    return body
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`${fallbackMessage} timed out. In local development, run pnpm dev:full so the API route is available.`)
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function getApiErrorMessage(body: Partial<ApiErrorResponse>, fallbackMessage: string) {
  return coerceMessage(body.error, fallbackMessage)
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return coerceMessage(error.message, fallbackMessage)
  }

  return coerceMessage(error, fallbackMessage)
}

function coerceMessage(value: unknown, fallbackMessage: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed && trimmed !== '[object Object]' ? trimmed : fallbackMessage
  }

  if (typeof value === 'object' && value !== null) {
    for (const key of ['message', 'error', 'detail', 'details']) {
      const nestedValue = (value as Record<string, unknown>)[key]
      const nestedMessage = coerceMessage(nestedValue, '')
      if (nestedMessage) {
        return nestedMessage
      }
    }
  }

  return fallbackMessage
}

async function assertApiAvailable(fallbackMessage: string) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), API_PREFLIGHT_TIMEOUT_MS)

  try {
    const response = await fetch('/api/health', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    const contentType = response.headers.get('content-type') ?? ''

    if (!contentType.includes('application/json')) {
      throw new Error(`${fallbackMessage} API is not running. In local development, use pnpm dev:full instead of pnpm dev so Vercel API routes are available.`)
    }

    if (!response.ok) {
      const body = await response.json() as ApiErrorResponse
      throw new Error(getApiErrorMessage(body, fallbackMessage))
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`${fallbackMessage} API health check timed out. In local development, use pnpm dev:full so Vercel API routes are available.`)
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

const initialExample = EXAMPLES[0] ?? {
  id: 'fallback',
  label: 'Fallback',
  mode: 'notes' as const,
  description: 'Fallback example.',
  input: 'C4 q, E4 q, G4 h',
}

function loadLocalDraft(): LocalDraft | null {
  try {
    const rawDraft = window.localStorage.getItem(AUTOSAVE_KEY)
    if (!rawDraft) {
      return null
    }

    const draft = JSON.parse(rawDraft) as Partial<LocalDraft>
    if ((draft.mode !== 'notes' && draft.mode !== 'chords') || typeof draft.input !== 'string') {
      return null
    }

    return {
      projectId: typeof draft.projectId === 'string' ? draft.projectId : null,
      projectTitle: typeof draft.projectTitle === 'string' ? draft.projectTitle : 'Untitled sketch',
      mode: draft.mode,
      input: draft.input.includes('[object Object]') ? initialExample.input : draft.input,
      assistantPrompt: typeof draft.assistantPrompt === 'string' ? draft.assistantPrompt : '',
      noteGenerationPrompt: typeof draft.noteGenerationPrompt === 'string' && draft.noteGenerationPrompt.trim()
        ? draft.noteGenerationPrompt
        : DEFAULT_NOTE_GENERATION_PROMPT,
      analysis: draft.analysis ?? null,
    }
  } catch {
    return null
  }
}

const initialGeminiStatus: GeminiUiStatus = {
  available: false,
  checkedAt: '',
  message: 'Checking Gemini...',
  model: 'gemini-3.1-flash-lite-preview',
  state: 'checking',
}

export function App() {
  const [initialDraft] = useState<LocalDraft | null>(() => loadLocalDraft())
  const [state, setState] = useState<RenderState>(() => renderInput(
    initialDraft?.mode ?? initialExample.mode,
    initialDraft?.input ?? initialExample.input,
    initialDraft?.projectTitle ?? 'Untitled sketch',
  ))
  const [view, setView] = useState<AppView>(() => getCurrentView())
  const [projectId, setProjectId] = useState<string | null>(initialDraft?.projectId ?? null)
  const [projectTitle, setProjectTitle] = useState(initialDraft?.projectTitle ?? 'Untitled sketch')
  const [projects, setProjects] = useState<SavedProject[]>([])
  const [assistantPrompt, setAssistantPrompt] = useState(initialDraft?.assistantPrompt ?? '')
  const [noteGenerationPrompt, setNoteGenerationPrompt] = useState(initialDraft?.noteGenerationPrompt ?? DEFAULT_NOTE_GENERATION_PROMPT)
  const [analysis, setAnalysis] = useState<ComposerAssistResult | null>(initialDraft?.analysis ?? null)
  const [isAssisting, setIsAssisting] = useState(false)
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isInspectorOpen, setIsInspectorOpen] = useState(false)
  const [geminiStatus, setGeminiStatus] = useState<GeminiUiStatus>(initialGeminiStatus)
  const [serverMessage, setServerMessage] = useState<string | null>(null)
  const [noteGenerationMessage, setNoteGenerationMessage] = useState<string | null>(null)

  const activeScore = state.parseResult.ok ? state.parseResult.value : null
  const warnings = state.parseResult.warnings
  const errors = state.parseResult.errors
  const insights = useMemo(() => getScoreInsights(activeScore), [activeScore])

  useEffect(() => {
    const handleHashChange = () => setView(getCurrentView())
    window.addEventListener('hashchange', handleHashChange)

    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    let isMounted = true

    const refreshGeminiStatus = async () => {
      setGeminiStatus((current) => ({
        ...current,
        message: current.checkedAt ? 'Refreshing Gemini status...' : 'Checking Gemini...',
        state: 'checking',
      }))

      try {
        const response = await fetch('/api/gemini-status', {
          headers: { Accept: 'application/json' },
        })
        const contentType = response.headers.get('content-type') ?? ''

        if (!contentType.includes('application/json')) {
          throw new Error('Gemini status API is not running. In local development, use pnpm dev:full.')
        }

        const body = await response.json() as GeminiStatusResponse & ApiErrorResponse
        if (!response.ok) {
          throw new Error(getApiErrorMessage(body, 'Gemini status check failed.'))
        }

        if (isMounted) {
          setGeminiStatus({
            ...body,
            state: body.available ? 'available' : 'unavailable',
          })
        }
      } catch (error) {
        if (isMounted) {
          setGeminiStatus({
            available: false,
            checkedAt: new Date().toISOString(),
            message: getErrorMessage(error, 'Gemini status check failed.'),
            model: 'gemini-3.1-flash-lite-preview',
            state: 'unavailable',
          })
        }
      }
    }

    void refreshGeminiStatus()
    const intervalId = window.setInterval(refreshGeminiStatus, GEMINI_STATUS_INTERVAL_MS)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const draft: LocalDraft = {
      projectId,
      projectTitle,
      mode: state.mode,
      input: state.input,
      assistantPrompt,
      noteGenerationPrompt,
      analysis,
    }

    window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draft))
  }, [analysis, assistantPrompt, noteGenerationPrompt, projectId, projectTitle, state.input, state.mode])

  const updateDraft = (mode: InputMode, input: string) => {
    setState(renderInput(mode, input, projectTitle))
    setServerMessage(null)
  }

  const handleRender = (mode: InputMode, input: string) => {
    setState(renderInput(mode, input, projectTitle))
  }

  const handleProjectTitleChange = (title: string) => {
    setProjectTitle(title)
    setState((current) => renderInput(current.mode, current.input, title))
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
      const body = await fetchJson<{ result?: ComposerAssistResult }>('/api/composer-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          mode: state.mode,
          input: state.input,
          prompt: assistantPrompt,
        }),
      }, 'Composer assistant failed.')

      if (!body.result) {
        throw new Error('Composer assistant failed.')
      }
      setAnalysis(body.result)
      if (task === 'generate') {
        updateDraft(body.result.suggestedMode, body.result.generatedInput)
      }
    } catch (error) {
      setServerMessage(getErrorMessage(error, 'Composer assistant failed.'))
    } finally {
      setIsAssisting(false)
    }
  }

  const saveCurrentProject = async () => {
    setIsSaving(true)
    setServerMessage(null)

    try {
      const payload: SaveProjectRequest = {
        title: projectTitle,
        mode: state.mode,
        input: state.input,
        score: activeScore,
        musicXml: state.musicXml,
        analysis,
      }
      if (projectId) {
        payload.id = projectId
      }

      const body = await fetchJson<{ project?: SavedProject }>('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, 'Project could not be saved.')

      if (!body.project) {
        throw new Error('Project could not be saved.')
      }
      setProjectId(body.project.id)
      setProjectTitle(body.project.title)
      setProjects((current) => [body.project!, ...current.filter((project) => project.id !== body.project!.id)])
      setServerMessage('Project saved.')
    } catch (error) {
      setServerMessage(getErrorMessage(error, 'Project could not be saved.'))
    } finally {
      setIsSaving(false)
    }
  }

  const refreshProjects = async () => {
    setServerMessage(null)

    try {
      const body = await fetchJson<ProjectListResponse>('/api/projects', {}, 'Projects could not be loaded.')

      setProjects(body.projects)
      setServerMessage(body.projects.length > 0 ? 'Projects loaded.' : 'No saved projects yet.')
    } catch (error) {
      setServerMessage(getErrorMessage(error, 'Projects could not be loaded.'))
    }
  }

  const loadProject = (project: SavedProject) => {
    setProjectId(project.id)
    setProjectTitle(project.title)
    setAnalysis(project.analysis)
    updateDraft(project.mode, project.input)
    setServerMessage(`Loaded ${project.title}.`)
  }

  const newSketch = () => {
    setProjectId(null)
    setProjectTitle('Untitled sketch')
    setAssistantPrompt('')
    setNoteGenerationPrompt(DEFAULT_NOTE_GENERATION_PROMPT)
    setAnalysis(null)
    updateDraft(initialExample.mode, initialExample.input)
    setServerMessage('New sketch ready.')
  }

  const generateNotesFromText = async () => {
    const prompt = noteGenerationPrompt.trim()
    if (!prompt) {
      setNoteGenerationMessage('Describe the notes you want first.')
      return
    }

    setIsGeneratingNotes(true)
    setServerMessage(null)
    setNoteGenerationMessage('Generating StaffSmith note syntax...')

    try {
      const body = await fetchJson<{ result?: ComposerAssistResult }>('/api/composer-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'generate',
          mode: 'notes',
          input: state.input,
          prompt: `Generate StaffSmith notes mode notation from this text. Use only supported StaffSmith syntax. Prefer compact 4/4 measures with useful dynamics and expression tokens when appropriate.\n\n${prompt}`,
        }),
      }, 'Note generation failed.')

      if (!body.result) {
        throw new Error('Note generation failed.')
      }
      setAnalysis(body.result)
      updateDraft('notes', body.result.generatedInput)
      setNoteGenerationMessage('Generated notes from text.')
      setServerMessage('Generated notes from text.')
    } catch (error) {
      setNoteGenerationMessage(getErrorMessage(error, 'Note generation failed.'))
    } finally {
      setIsGeneratingNotes(false)
    }
  }

  const exportProject = () => {
    downloadTextFile(
      `${toSafeFilename(projectTitle)}.staffsmith.json`,
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        projectId,
        title: projectTitle,
        mode: state.mode,
        input: state.input,
        score: activeScore,
        musicXml: state.musicXml,
        analysis,
      }, null, 2),
      'application/json;charset=utf-8',
    )
    setServerMessage('Project export created.')
  }

  const copySource = async () => {
    await copyText(state.input)
    setServerMessage('Source copied.')
  }

  const copyMusicXml = async () => {
    if (!state.musicXml) {
      return
    }

    await copyText(state.musicXml)
    setServerMessage('MusicXML copied.')
  }

  const downloadMusicXml = () => {
    if (!state.musicXml) {
      return
    }

    downloadTextFile(`${toSafeFilename(projectTitle)}.musicxml`, state.musicXml, 'application/vnd.recordare.musicxml+xml;charset=utf-8')
    setServerMessage('MusicXML export created.')
  }

  const printScore = () => {
    window.print()
  }

  return (
    <div className="app-shell">
      <header className="workspace-header">
        <div className="brand-lockup">
          <img className="brand-mark" src="/favicon.svg" alt="" aria-hidden="true" />
          <h1>Staffsmith</h1>
        </div>
        <div className="header-project-console" aria-label="Project console">
          <label className="visually-hidden" htmlFor="project-title">
            Title
          </label>
          <input
            id="project-title"
            className="project-title-input"
            value={projectTitle}
            onChange={(event) => handleProjectTitleChange(event.target.value)}
            placeholder="Untitled sketch"
          />
          <div className="header-project-actions">
            <button type="button" className="icon-button" onClick={newSketch} aria-label="New sketch" title="New sketch">
              <FilePlus2 size={17} aria-hidden="true" />
            </button>
            <button type="button" className="icon-button" onClick={copySource} aria-label="Copy source" title="Copy source">
              <Copy size={17} aria-hidden="true" />
            </button>
            <button type="button" className="icon-button" onClick={exportProject} aria-label="Export project" title="Export project">
              <Download size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
        <nav className="workspace-nav" aria-label="Primary">
          <a className={view === 'workspace' ? 'is-active' : ''} href="#/" aria-label="Workspace" title="Workspace">
            <LayoutDashboard size={17} aria-hidden="true" />
          </a>
          <a className={view === 'help' ? 'is-active' : ''} href="#/help" aria-label="Syntax help" title="Syntax help">
            <CircleHelp size={17} aria-hidden="true" />
          </a>
          <a
            className={view === 'changelog' ? 'is-active' : ''}
            href="#/changelog"
            aria-label="Changelog"
            title="Changelog"
          >
            <ScrollText size={17} aria-hidden="true" />
          </a>
        </nav>
        <div className="workspace-metrics" aria-label="Current score summary">
          <span
            className={`service-light service-light--${geminiStatus.state}`}
            title={`${geminiStatus.message}${geminiStatus.latencyMs ? ` (${geminiStatus.latencyMs} ms)` : ''}`}
          >
            {geminiStatus.state === 'checking'
              ? <LoaderCircle size={15} aria-hidden="true" />
              : <Bot size={15} aria-hidden="true" />}
            Gemini
          </span>
          <span title="Input mode">
            <Music2 size={15} aria-hidden="true" />
            {state.mode === 'notes' ? 'Notes' : 'Chords'}
          </span>
          <span title="Measure count">
            <Ruler size={15} aria-hidden="true" />
            {activeScore ? `${insights.measureCount} m.` : '0 m.'}
          </span>
          <span title={activeScore ? 'Pitch range' : 'Parse status'}>
            <Gauge size={15} aria-hidden="true" />
            {activeScore ? insights.pitchRange : summarizeErrors(errors)}
          </span>
          <button
            type="button"
            className="inspector-toggle icon-button"
            onClick={() => setIsInspectorOpen((current) => !current)}
            aria-expanded={isInspectorOpen}
            aria-controls="score-inspector"
            aria-label={isInspectorOpen ? 'Close inspector' : 'Open inspector'}
            title={isInspectorOpen ? 'Close inspector' : 'Open inspector'}
          >
            {isInspectorOpen ? <PanelRightClose size={17} aria-hidden="true" /> : <PanelRightOpen size={17} aria-hidden="true" />}
          </button>
        </div>
      </header>

      {view === 'help' ? (
        <main className="help-layout">
          <SyntaxHelp />
        </main>
      ) : view === 'changelog' ? (
        <main className="help-layout">
          <ChangelogPage />
        </main>
      ) : (
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

          <SectionCard title="Text To Notes">
            <label className="visually-hidden" htmlFor="note-generation-prompt">
              Text idea
            </label>
            <textarea
              id="note-generation-prompt"
              className="generation-textarea"
              rows={2}
              value={noteGenerationPrompt}
              onChange={(event) => {
                setNoteGenerationPrompt(event.target.value)
                setNoteGenerationMessage(null)
              }}
              placeholder="Beginner flute solo, folk-jazz color, gentle crescendo."
            />
            <div className="studio-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={generateNotesFromText}
                disabled={isGeneratingNotes}
              >
                <WandSparkles size={16} aria-hidden="true" />
                {isGeneratingNotes ? 'Generating...' : 'Generate'}
              </button>
              <a className="inline-help-link" href="#/help">
                <CircleHelp size={16} aria-hidden="true" />
                Help
              </a>
            </div>
            {noteGenerationMessage ? <p className="server-message">{noteGenerationMessage}</p> : null}
          </SectionCard>

          <SectionCard title="AI Studio">
            <label className="visually-hidden" htmlFor="assistant-prompt">
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
                <Search size={16} aria-hidden="true" />
                Analyze
              </button>
              <button type="button" className="secondary-button" onClick={() => runAssist('generate')} disabled={isAssisting}>
                <Sparkles size={16} aria-hidden="true" />
                Idea
              </button>
              <button type="button" className="secondary-button" onClick={saveCurrentProject} disabled={isSaving}>
                <Save size={16} aria-hidden="true" />
                Save
              </button>
              <button type="button" className="ghost-button" onClick={refreshProjects}>
                <FolderOpen size={16} aria-hidden="true" />
                Recent
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
        </div>

        <div className="preview-column">
          <ScorePreview
            musicXml={state.musicXml}
            title={projectTitle}
            onCopyMusicXml={copyMusicXml}
            onDownloadMusicXml={downloadMusicXml}
            onPrintScore={printScore}
          />
        </div>
        <aside
          id="score-inspector"
          className={isInspectorOpen ? 'inspector-sidebar is-open' : 'inspector-sidebar'}
          aria-label="Score inspector"
        >
          <div className="inspector-sidebar__header">
            <h2>Inspector</h2>
            <button type="button" className="ghost-button" onClick={() => setIsInspectorOpen(false)}>
              Close
            </button>
          </div>
          <SectionCard title="Status" tone={errors.length > 0 ? 'danger' : 'success'}>
            <p className="status-line">{summarizeErrors(errors)}</p>
            <p className="muted">Last render: {state.lastUpdated}</p>
            {activeScore ? (
              <dl className="score-stats score-stats--compact">
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

          <SectionCard title="Score Intelligence">
            <dl className="score-stats score-stats--stacked">
              <div>
                <dt>Range</dt>
                <dd>{insights.pitchRange}</dd>
              </div>
              <div>
                <dt>Density</dt>
                <dd>{insights.density}</dd>
              </div>
              <div>
                <dt>Durations</dt>
                <dd>{insights.topDurations}</dd>
              </div>
              <div>
                <dt>Harmony</dt>
                <dd>{insights.chordPalette}</dd>
              </div>
            </dl>
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
                Parsed successfully. StaffSmith generated canonical MusicXML ready for preview and export.
              </p>
            )}
          </SectionCard>
        </aside>
      </main>
      )}
    </div>
  )
}
