import { neon } from '@neondatabase/serverless'
import type { ComposerAssistResult, SavedProject, SaveProjectRequest } from '../../src/lib/apiTypes'
import type { InputMode } from '../../src/music/model/types'
import { getDatabaseUrl, getUnpooledDatabaseUrl } from './env'
import { fail } from './http'

type SqlClient = ReturnType<typeof neon>

type ProjectRow = {
  id: string
  title: string
  mode: InputMode
  input: string
  score: SavedProject['score']
  music_xml: string | null
  analysis: ComposerAssistResult | null
  created_at: Date | string
  updated_at: Date | string
}

let sqlClient: SqlClient | null = null
let migrationSqlClient: SqlClient | null = null
let schemaReady: Promise<void> | null = null

function getSql() {
  if (!sqlClient) {
    sqlClient = neon(getDatabaseUrl())
  }

  return sqlClient
}

function getMigrationSql() {
  if (!migrationSqlClient) {
    migrationSqlClient = neon(getUnpooledDatabaseUrl())
  }

  return migrationSqlClient
}

export async function ensureSchema() {
  if (!schemaReady) {
    const sql = getMigrationSql()
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS staffsmith_projects (
          id text PRIMARY KEY,
          title text NOT NULL,
          mode text NOT NULL CHECK (mode IN ('notes', 'chords')),
          input text NOT NULL,
          score jsonb,
          music_xml text,
          analysis jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS staffsmith_projects_updated_at_idx
        ON staffsmith_projects (updated_at DESC)
      `
    })()
  }

  await schemaReady
}

export async function listProjects(): Promise<SavedProject[]> {
  await ensureSchema()

  const rows = await getSql()`
    SELECT id, title, mode, input, score, music_xml, analysis, created_at, updated_at
    FROM staffsmith_projects
    ORDER BY updated_at DESC
    LIMIT 12
  ` as ProjectRow[]

  return rows.map(projectFromRow)
}

export async function saveProject(payload: SaveProjectRequest): Promise<SavedProject> {
  await ensureSchema()

  if (payload.mode !== 'notes' && payload.mode !== 'chords') {
    fail(400, 'Project mode must be notes or chords.')
  }

  if (!payload.input.trim()) {
    fail(400, 'Project input cannot be empty.')
  }

  const id = payload.id?.trim() || crypto.randomUUID()
  const title = payload.title?.trim() || defaultTitle(payload.input)
  const scoreJson = JSON.stringify(payload.score)
  const analysisJson = JSON.stringify(payload.analysis ?? null)

  const rows = await getSql()`
    INSERT INTO staffsmith_projects (
      id,
      title,
      mode,
      input,
      score,
      music_xml,
      analysis,
      created_at,
      updated_at
    )
    VALUES (
      ${id},
      ${title},
      ${payload.mode},
      ${payload.input},
      ${scoreJson}::jsonb,
      ${payload.musicXml},
      ${analysisJson}::jsonb,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      mode = EXCLUDED.mode,
      input = EXCLUDED.input,
      score = EXCLUDED.score,
      music_xml = EXCLUDED.music_xml,
      analysis = EXCLUDED.analysis,
      updated_at = now()
    RETURNING id, title, mode, input, score, music_xml, analysis, created_at, updated_at
  ` as ProjectRow[]

  const project = rows[0]
  if (!project) {
    fail(500, 'Project could not be saved.')
  }

  return projectFromRow(project)
}

function projectFromRow(row: ProjectRow): SavedProject {
  return {
    id: row.id,
    title: row.title,
    mode: row.mode,
    input: row.input,
    score: row.score,
    musicXml: row.music_xml,
    analysis: row.analysis,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

function defaultTitle(input: string) {
  const title = input.split(/\s+/).slice(0, 6).join(' ').replace(/[,\s|]+$/g, '')
  return title || 'Untitled StaffSmith idea'
}
