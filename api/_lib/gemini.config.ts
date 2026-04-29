export const GEMINI_CONFIG = {
  model: 'gemini-3.1-flash-lite-preview',
  apiBase: 'https://generativelanguage.googleapis.com/v1beta/models',

  // Per-task generation parameters sent in every request body.
  // https://ai.google.dev/api/generate-content#generationconfig
  generation: {
    analyze: {
      temperature: 0.5,
      maxOutputTokens: 4096,
      topP: 0.9,
      responseMimeType: 'application/json',
    },
    generate: {
      temperature: 0.85,
      maxOutputTokens: 9807,
      topP: 0.95,
      responseMimeType: 'application/json',
    },
  },

  // Shown to the model before user content. Describes its role and the
  // expected JSON shape of every response.
  systemInstruction: `You are StaffSmith's music assistant. Return only JSON matching this TypeScript type:
{
  "summary": string,        // one-sentence description of the composition
  "keyCenter": string,      // e.g. "D minor" or "G major"
  "suggestedMode": "notes" | "chords",
  "generatedInput": string, // plain StaffSmith notation — see rules below
  "notes": string[]         // up to 6 concise coaching tips
}`,

  // Appended after the syntax guide. One rule per item — add or remove freely.
  generationRules: [
    'highest priority for generatedInput: compelling notes and intentional rests/pauses; rhythm and silence must carry the idea before decorative markings',
    'keep generatedInput directly parseable by StaffSmith',
    'generatedInput must be a single plain StaffSmith notation string, never an object, array, markdown block, or JSON structure',
    'do not return nested notes, measures, events, pitch objects, or token objects inside generatedInput',
    'for natural-language note generation, prefer suggestedMode "notes"',
    'use the same smart composer assumptions as the UI: complete 4/4 measures, add | before an overflow, and use explicit rests or pauses for missing beats',
    'use only documented StaffSmith tokens from the syntax guide: durations w/h/q/8/16/32, rests R/rest/pause, bars |, dynamics, expressions, hairpins, slurs, and supported lead-sheet chord symbols',
    'when musically sensible, actually use the richer syntax: 16/32-note figures, pauses, chromatic pitches, slurs, and bracketed performance text',
    'include dynamics, expression, hairpin tokens, and slur parentheses when the user asks for mood, articulation, smooth bowing, or intensity, but keep them secondary to note and pause choices',
    'if the user names an artist or band, translate that into broad musical traits rather than imitating the named artist directly',
    'keep coaching notes concise and practical',
  ],

  // Returned as generatedInput when Gemini is unreachable or returns garbage.
  fallbackNotation: 'mp [airy flute] ( D5 q, F5 q, A5 8, G5 16, A5 16, B5 q ) | pause 8, D5 32, E5 32, F5 16, G5 q, A5 q, D5 q | > G5 q, F5 q, E5 q, D5 q',
} as const

export type GeminiTask = keyof typeof GEMINI_CONFIG.generation
