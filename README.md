# StaffSmith

StaffSmith is a local-first MVP web app that turns raw note text or chord symbols into readable sheet music / lead-sheet notation in the browser. It uses a pure TypeScript parsing pipeline, normalizes input into an internal score model, converts that model into MusicXML, and renders the result with OpenSheetMusicDisplay.

## Setup

```bash
pnpm install
pnpm dev
```

Use `pnpm dev` for the browser-only Vite surface. Use `pnpm dev:full` when you need the Vercel API routes for persistence or Gemini assistance.

For a production build:

```bash
pnpm build
```

## Deploying to Vercel

This repo is configured for Vercel as a Vite static app:

- install command: `pnpm install --frozen-lockfile`
- build command: `pnpm build`
- output directory: `dist`
- Node.js runtime: Vercel maps the `>=22.0.0 <26.0.0` engine range to its current 24.x runtime

Required server environment variables:

- `GEMINI_API_KEY`: used only by `/api/composer-assist`
- `DATABASE_URL`: pooled Neon Postgres URL for runtime queries
- `DATABASE_URL_UNPOOLED`: direct Neon Postgres URL for schema setup

Do not expose these with a `VITE_` prefix. Add them to the Vercel project as encrypted environment variables:

```bash
pnpm dlx vercel@latest env add GEMINI_API_KEY
pnpm dlx vercel@latest env add DATABASE_URL
pnpm dlx vercel@latest env add DATABASE_URL_UNPOOLED
```

With Git integration, import the repository in Vercel and keep the project root set to the repository root. With the Vercel CLI:

```bash
pnpm dlx vercel@latest link
pnpm dlx vercel@latest build --yes
pnpm dlx vercel
pnpm dlx vercel --prod
```

## Architecture

Core structure:

```text
src/
  components/
  features/editor/
  features/renderer/
  music/model/
  music/musicxml/
  music/parser/
  music/theory/
  lib/
```

Data flow:

1. UI collects raw text plus a mode toggle.
2. A pure parser converts input into a normalized `Score`.
3. The MusicXML generator turns `Score` into canonical MusicXML.
4. OpenSheetMusicDisplay renders the MusicXML in the preview pane.

Key design decisions:

- MusicXML is the canonical rendering/export format.
- Parsers are renderer-agnostic and testable.
- Chord rendering uses lead-sheet style harmony symbols plus helper root notes for the MVP.
- Incomplete note measures are padded with rests during MusicXML generation rather than hidden inside parsing.
- Part layout presets map musician-facing choices (Orchestral Solo, Standard Part, For Children's Songs) to notation density, system spacing, and measures per system.

## Supported Syntax

### Notes mode

Accepted syntax:

- `C4 q, D4 q, E4 h`
- `C4 E4 G4 | F4 A4 C5`
- `C4 h, R h | R w | D4 w`
- `mf [dolce] C4 q, E4 q, G4 h`
- `p C4 E4 G4 | < F4 A4 C5 | > G4 h`
- bar separators with `|`
- durations: `w`, `h`, `q`, `8`
- rests: `R` or `rest`, with optional duration such as `R w` or `rest q`
- the Composer board inserts barlines automatically when a note/rest would overflow a 4/4 measure or complete one
- dynamics: `pp`, `p`, `mp`, `mf`, `f`, `ff`
- expression words: `dolce`, `legato`, `staccato`, `tenuto`, `cantabile`, `espressivo`, `rit.`, `accel.`
- custom expression text: `[like_this]`
- volume changes: `<` or `cresc`, `>` or `dim`

Rules:

- Note names require octave numbers.
- Durations are optional and default to quarter notes.
- Measures currently assume 4/4.
- Full-measure rest runs are used by the MusicXML export for page-turn and long-silence cue placement.

### Chords mode

Accepted syntax:

- `C`
- `Cm`
- `Cmaj7`
- `Am7`
- `D7`
- `F#dim`
- `Bbmaj7`
- `Cmaj7 | Am7 | Dm7 G7 | Cmaj7`
- `mf Cmaj7 | < Am7 | Dm7 G7 | p Cmaj7`
- dynamics, expression text, and volume changes work in chord mode too

Rules:

- Up to four chord symbols per measure are supported in the MVP.
- Chord durations are distributed per measure using simple lead-sheet timing.
- The Composer board includes root, quality, and progression buttons for common lead-sheet entry.

## Working Examples

- `C4 q, E4 q, G4 h`
- `mf [dolce] C4 q, E4 q, G4 h`
- `p C4 E4 G4 | < F4 A4 C5 | > G4 h`
- `mf Cmaj7 | < Am7 | Dm7 G7 | p Cmaj7`
- `Bbmaj7 | Gm7 | C7 | F#dim`

## Validation Behavior

StaffSmith reports:

- unexpected tokens in the active mode
- durations without a preceding note
- unsupported chord symbols
- note measures that exceed 4/4
- chord measures with more than four symbols

## Short Architecture Summary

The parser layer is intentionally independent from OpenSheetMusicDisplay. `music/parser` produces typed `Score`, `Measure`, `NoteEvent`, and `ChordEvent` data. `music/musicxml` owns MusicXML generation, while `features/renderer` only handles browser rendering concerns.

## Next Improvements

- MIDI import
- better rhythm parsing
- ABC import/export
- direct note editing on staff
- audio playback
- transposition tools
