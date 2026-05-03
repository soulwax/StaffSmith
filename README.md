# StaffSmith

StaffSmith is a local-first MVP web app and the first official implementation of StaffScript, a readable text-based notation language for notes, chords, expressions, sections, dynamics, repetition, and future AI-assisted composition. It uses a pure TypeScript parsing pipeline, normalizes input into an internal score model, converts that model into MusicXML, and renders the result with OpenSheetMusicDisplay.

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
- Part layout presets map musician-facing choices (Orchestral Solo, Standard Part, For Children's Songs) to notation density, system spacing, and measures per system. Orchestral Solo uses a 30% smaller content scale, 10 mm page margins, and a 12-system page target for compact solo parts.

## StaffScript

StaffScript is StaffSmith's official notation language. Use `.staff` for source files, or `.staff.txt` when plain-text tooling is easier. The full language reference lives in [`docs/StaffScript-v0.1.md`](docs/StaffScript-v0.1.md).

Quick example:

```staff
@version=0.1
@title="Take 5 for the Flute"
@instrument=flute
@clef=treble
@tempo=120
@time=5/4
@key=Dm
@dur=q

@motif intro = ( D5, F5, A5 h )
@motif fall = > G5, F5, E5, D5

section intro {
  mp [intro] use intro | use fall, R q
}

repeat 2 {
  use intro
}
```

### Notes mode

Accepted syntax:

- `@dur=q D5, F5, A5 h`
- `C4 q, D4 q, E4 h`
- `C4 E4 G4 | F4 A4 C5`
- `C4 h, R h | R w | D4 w`
- `( C4 8, D4 8, E4 q ) pause q, G4 32, A4 32, B4 16, C5 8`
- `pp [flutter] F#5 32, G5 32, A5 16, pause 8, ( Bb5 8, C6 8 )`
- `mf [dolce] C4 q, E4 q, G4 h`
- `p C4 E4 G4 | < F4 A4 C5 | > G4 h`
- bar separators with `|`
- durations: `w`, `h`, `q`, `8`, `16`, `32`
- rests/pauses: `R`, `rest`, or `pause`, with optional duration such as `R w`, `rest q`, or `pause 8`
- smooth slurs/bows: spaced parentheses around notes, for example `( C4 q, D4 q )`
- the Composer board inserts barlines automatically when a note/rest would overflow the active time signature or complete a measure
- dynamics: `pp`, `p`, `mp`, `mf`, `f`, `ff`
- expression words: `dolce`, `legato`, `staccato`, `tenuto`, `cantabile`, `espressivo`, `rit.`, `accel.`, `a-tempo`, `tempo`
- custom expression text: `[like_this]`
- volume changes: `<`, `cresc`, or `cresc.`, and `>`, `dim`, `dim.`, `decresc`, `decresc.`, or `diminuendo`
- sections: `section intro { D5 q, F5 q, A5 h }`
- motifs: `@motif intro = ( D5 q, F5 q, A5 h )` then `use intro`
- compact motif aliases: `@intro = ( D5 q, F5 q, A5 h )`
- repeat blocks: `repeat 2 { D5 q, F5 q, A5 h }` or `x2 { D5 q, F5 q, A5 h }`

Rules:

- Note names require octave numbers.
- Durations are optional and default to `@dur` when set, otherwise quarter notes.
- Duration values are `w=4 beats`, `h=2`, `q=1`, `8=0.5`, `16=0.25`, and `32=0.125`.
- Fast values are intended for clean beat-grouped gestures, ornaments, flourishes, and serious orchestral-style short-note writing.
- Measures support the active `@time` signature for overflow checks; the MVP is best exercised with simple signatures like `4/4` and `5/4`.
- Full-measure rest runs are used by the MusicXML export for page-turn and long-silence cue placement.
- Long generated note pieces are supported as multi-section notation with bracketed labels such as `[intro]`, `[theme]`, `[freestyle]`, `[return]`, `[finale]`, and `[coda]`.
- For professional readability, longer fast passages should be shaped into phrase groups with breath pauses and clean beat grouping rather than uninterrupted walls of short notes.

### Chords mode

Accepted syntax:

- `@mode=chords`
- `C`
- `Cm`
- `Cmaj7`
- `Cmin7`
- `C7`
- `Cm7`
- `Am7`
- `D7`
- `F#dim`
- `Bbmaj7`
- `Caug`
- `Csus`
- `Csus2`
- `Csus4`
- `Cadd9`
- `Cmaj7 | Am7 | Dm7 G7 | Cmaj7`
- `mf Cmaj7 | < Am7 | Dm7 G7 | p Cmaj7`
- dynamics, expression text, and volume changes work in chord mode too

Rules:

- Up to four chord symbols per measure are supported in the MVP.
- Chord durations are distributed per measure using simple lead-sheet timing.
- The Composer board includes root, quality, and progression buttons for common lead-sheet entry.

## Working Examples

- `C4 q, E4 q, G4 h`
- `@dur=q D5, F5, A5 h`
- `section intro { D5 q, F5 q, A5 h }`
- `@motif intro = ( D5 q, F5 q, A5 h ) use intro`
- `repeat 2 { D5 q, F5 q, A5 h }`
- `( C4 8, D4 8, E4 q ) pause q, G4 32, A4 32, B4 16, C5 8`
- `mf [dolce] C4 q, E4 q, G4 h`
- `p C4 E4 G4 | < F4 A4 C5 | > G4 h`
- `mf Cmaj7 | < Am7 | Dm7 G7 | p Cmaj7`
- `Bbmaj7 | Gm7 | C7 | F#dim`

## Metadata

StaffScript metadata directives include:

- `@version=0.1`
- `@title="Title"`
- `@composer="Composer"`
- `@instrument=flute`
- `@clef=treble`
- `@tempo=120`
- `@time=5/4`
- `@key=Dm`
- `@mode=notes` or `@mode=chords`
- `@dur=q`

The notation trinity is optional: omitted `@clef`, `@key`, and `@time` render as treble/violin clef, no key signature, and 4/4. `@clef` accepts treble/violin, bass, alto, and tenor. `@key` accepts all conventional key signatures by name or direct fifth counts from `-7` to `7`. `@time` accepts numeric meters such as `4/4`, `6/8`, `7/8`, and `12/8`, plus `common` and `cut`.

Unknown metadata keys are preserved where reasonable and do not crash parsing.

## Validation Behavior

StaffSmith reports:

- unexpected tokens in the active mode
- durations without a preceding note
- unsupported chord symbols
- note measures that exceed the active time signature
- chord measures with more than four symbols

## Short Architecture Summary

The parser layer is intentionally independent from OpenSheetMusicDisplay. `music/parser` produces typed `Score`, `Measure`, `NoteEvent`, and `ChordEvent` data. `music/musicxml` owns MusicXML generation, while `features/renderer` only handles browser rendering concerns.

## Next Improvements

- StaffScript `.staff` import/export
- MIDI import
- better rhythm parsing
- ABC import/export
- direct note editing on staff
- audio playback
- transposition tools
- MusicXML polish
- AI-assisted composition over StaffScript sections and motifs
