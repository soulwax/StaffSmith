import type { InputMode, Score } from '../music/model/types'

export type ComposerAssistTask = 'analyze' | 'generate'

export type ComposerAssistRequest = {
  task: ComposerAssistTask
  mode: InputMode
  input: string
  prompt?: string
}

export type ComposerAssistResult = {
  summary: string
  keyCenter: string
  suggestedMode: InputMode
  generatedInput: string
  notes: string[]
}

export type SavedProject = {
  id: string
  title: string
  mode: InputMode
  input: string
  score: Score | null
  musicXml: string | null
  analysis: ComposerAssistResult | null
  createdAt: string
  updatedAt: string
}

export type SaveProjectRequest = {
  id?: string
  title?: string
  mode: InputMode
  input: string
  score: Score | null
  musicXml: string | null
  analysis?: ComposerAssistResult | null
}

export type ProjectListResponse = {
  projects: SavedProject[]
}

export type GeminiStatusResponse = {
  available: boolean
  checkedAt: string
  latencyMs?: number
  message: string
  model: string
}

export type ApiErrorResponse = {
  error: string
  missingEnv?: string[]
}
