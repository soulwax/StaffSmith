import { fail } from './http'

export function requireEnv(name: 'DATABASE_URL' | 'DATABASE_URL_UNPOOLED' | 'GEMINI_API_KEY'): string {
  const value = process.env[name]

  if (!value) {
    fail(500, `Missing required server environment variable: ${name}`, {
      missingEnv: [name],
    })
  }

  return value
}

export function getDatabaseUrl() {
  return requireEnv('DATABASE_URL')
}

export function getUnpooledDatabaseUrl() {
  return requireEnv('DATABASE_URL_UNPOOLED')
}

export function getGeminiApiKey() {
  return requireEnv('GEMINI_API_KEY')
}
