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
      maxOutputTokens: 32768,
      topP: 0.95,
      responseMimeType: 'application/json',
    },
  },

  longGeneration: {
    defaultLongMeasures: 96,
    fiveMinuteMeasures: 120,
    maxGeneratedMeasures: 160,
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
    'when the user asks for a full piece, complete composition, beginning-to-end composition, solo, or long music, generatedInput should normally be at least 24 measures and may be 48-96 measures when the prompt asks for something expansive',
    'when the user explicitly asks for around 100 measures, at least 100 measures, or a five-minute piece, target 100-120 complete 4/4 measures if the response budget allows',
    'if the user gives a very large allowance such as "up to 8096 notes", treat it as permission to be generous, not as a requirement to hit that exact count; write the longest coherent parseable piece the response budget allows',
    'do not shrink a full-piece request into a three- or four-measure sketch unless the user explicitly asks for a short idea',
    'for long generatedInput, write professionally engraved music: balanced 4- or 8-measure phrase groups, clear section labels, readable breath pauses, and fast passages that sit cleanly inside the beat',
    'use section labels in bracketed expression text for longer note pieces, for example [intro], [theme], [freestyle], [return], [finale], and [coda]',
    'avoid pages of unbroken 32nd notes; use fast 16/32-note material as featured freestyle segments, pickups, ornaments, transitions, and phrase peaks',
    'use the same smart composer assumptions as the UI: complete 4/4 measures, add | before an overflow, and use explicit rests or pauses for missing beats',
    'use only documented StaffSmith tokens from the syntax guide: durations w/h/q/8/16/32, rests R/rest/pause, bars |, dynamics, expressions, hairpins, slurs, and supported lead-sheet chord symbols',
    'when musically sensible, actually use the richer syntax: 16/32-note figures, pauses, chromatic pitches, slurs, and bracketed performance text',
    'include dynamics, expression, hairpin tokens, and slur parentheses when the user asks for mood, articulation, smooth bowing, or intensity, but keep them secondary to note and pause choices',
    'if the prompt references a copyrighted song or jazz standard, create an original non-infringing piece inspired only by broad traits such as meter feel, contour, instrumentation, and mood; do not quote or closely recreate the melody',
    'if the user names an artist or band, translate that into broad musical traits rather than imitating the named artist directly',
    'keep coaching notes concise and practical',
  ],

  // Returned as generatedInput when Gemini is unreachable or returns garbage.
  fallbackNotation: [
    'mp [intro] ( D5 q, F5 q, A5 h )',
    '< G5 q, A5 q, B5 q, A5 q',
    '> G5 q, F5 q, E5 q, D5 q',
    'pause h, D5 h',
    'mf [theme] D5 q, F5 q, A5 q, C6 q',
    '( B5 8, A5 8, G5 q, F5 q, E5 q )',
    '< F5 8, G5 8, A5 8, B5 8, C6 q, A5 q',
    '> G5 q, F5 q, E5 q, D5 q',
    'mp [freestyle] pause 8, D5 32, E5 32, F5 16, G5 q, A5 q, D5 q',
    '( A5 16, B5 16, C6 8, A5 8, G5 q, F5 q ) pause 8',
    'F#5 32, G5 32, A5 16, pause 8, B5 8, A5 8, G5 q, E5 q',
    '< D5 8, F5 8, A5 8, C6 8, B5 q, A5 q',
    'mf [return] D5 q, F5 q, A5 h',
    'G5 q, A5 q, B5 q, A5 q',
    '> G5 q, F5 q, E5 q, D5 q',
    'p [middle] R q, D5 q, F5 q, G5 q',
    '( A5 8, C6 8, B5 q, A5 q, G5 q )',
    'F5 16, G5 16, A5 8, pause 8, E5 8, D5 q, F5 q',
    '< G5 q, A5 q, C6 h',
    '> B5 q, A5 q, G5 q, F5 q',
    '[freestyle] D5 32, E5 32, F5 16, A5 8, G5 8, F5 q, E5 q, pause 8',
    '( D5 q, F5 q, A5 q, D6 q )',
    'mp D5 q, F5 q, A5 q, F5 q',
    'p [coda] C6 h, A5 q, D5 q',
    'mp [finale] pause q, D5 8, F5 8, A5 q, C6 q',
    'D6 16, C6 16, A5 8, G5 8, F5 8, E5 8, D5 q, pause 8',
    '< F5 q, A5 q, C6 q, D6 q',
    '> C6 q, A5 q, G5 q, F5 q',
    '[cadenza-like] D5 32, E5 32, F5 16, G5 16, A5 16, B5 8, A5 8, G5 q, F5 q',
    'pause h, A5 8, G5 8, F5 q',
    'p ( E5 q, F5 q, D5 h )',
    'pp D5 w',
  ].join(' | '),
} as const

export type GeminiTask = keyof typeof GEMINI_CONFIG.generation
