# Changelog

All notable StaffSmith changes will be documented in this file.

## 0.1.3 - 2026-04-29 - Expressive Durations

### Added

- Note mode now supports sixteenth durations with `16`, readable `pause` rest syntax, and slur parentheses for smooth note-to-note transitions.
- Composer, Syntax Help, README examples, and Gemini prompts now teach the same sixteenth-note, pause, and slur syntax.
- Gemini syntax guidance now explicitly enumerates parser-supported expression aliases, hairpin aliases, and chord families so AI output stays aligned with StaffSmith syntax.
- MusicXML export now emits standard short-note types, nested beams for fast runs, and MusicXML slur notations.
- Note mode now supports `32` thirty-second durations, MusicXML exports 8 divisions per quarter, and short notes are beamed in clean 4/4 beat groups.
- AI generation now weights notes and pauses first, then uses richer StaffSmith syntax such as 16/32-note figures, chromatic pitches, slurs, and bracketed performance text when musically useful.

### Changed

- The internal 4/4 rhythm grid now uses thirty-second-note units so smart bar insertion and incomplete-measure padding understand faster durations.

## 0.1.2 - 2026-04-29 - Engraved Part Layouts

### Added

- Composer now includes a colorful smart notation board for notes, rests, durations, octaves, accidentals, chord roots, chord qualities, progressions, dynamics, and expressions.
- Composer controls now use a tighter command-strip layout so note/chord building takes less vertical space.
- Smart note/rest insertion now adds barlines when a token would overflow or complete a 4/4 measure.
- Gemini generation rules and validation now know the same smart composer assumptions: complete measures, explicit rests for missing beats, and barlines before overflow.
- Score preview now offers musician-facing part layout categories: Orchestral Solo, Standard Part, and For Children's Songs.
- Note mode now supports explicit rests with `R` or `rest`, including durations such as `R w` and `rest q`.
- MusicXML export now includes professional part-layout defaults for A4 / 9x12 pages, mirrored inside/outside margins, notation font hints, system spacing, and print system/page break hints.
- Long explicit rest passages now receive cue-sized notes when silence exceeds 12 measures.

### Changed

- Orchestral Solo now shrinks the part content by 30%, uses 10 mm page margins, and targets 12 systems per page with 6-measure systems.
- Layout presets now drive both the on-screen preview and exported MusicXML instead of exposing raw size, spacing, or wrap percentages.
- Page-turn planning now prefers rest passages of at least 4 measures, then section changes, before falling back to the target page length.
- Eighth-note beaming now breaks across rests instead of joining note beams through silent beats.

### Fixed

- For Children's Songs preview no longer overflows past the page edge when using larger notation.
- Vercel builds no longer fail under `exactOptionalPropertyTypes` when a measure layout plan has no cue pitch.

## 0.1.1 - 2026-04-29 - AI Syntax Hardening

### Fixed

- AI-generated notation is now rejected before reaching the editor when any measure exceeds 4/4 (e.g. 6 eighth notes + 1 half note = 5 beats). The safe fallback phrase is substituted instead.
- The Gemini syntax guide now spells out duration beat values (`w=4, h=2, q=1, 8=0.5`) and includes a concrete example of an overfull measure so the model can self-correct before returning output.

### Added

- `api/_lib/gemini.config.ts` — single config file for all Gemini request parameters: model, API base URL, per-task `temperature` / `maxOutputTokens` / `topP` / `responseMimeType`, system instruction, generation rules, and fallback notation.
- Default landing notation updated to a four-bar D minor flute phrase with hairpins and a held final whole note.
- `CLAUDE.md` expanded with API layer architecture, environment variable setup, dev vs dev:full distinction, and test coverage notes.

### Changed

- Model name, generation config, system instruction, and generation rules are now sourced from `gemini.config.ts` across all API handlers — no more scattered hardcoded strings.

## 0.1.0 - 2026-04-28 - Production Reliability Release

### Highlights

- Production API routes now deploy cleanly on Vercel's ESM serverless runtime and `/api/health` is verified live.
- AI generation now uses only `gemini-3.1-flash-lite-preview`, with stricter StaffSmith syntax validation and a parseable local fallback when the pinned model is unavailable.
- Print/PDF export now starts on the first page with the score content instead of producing a blank leading page.

### Changed

- Header branding now reuses the shared `public/favicon.svg` asset.

## 2026-04-28 - Vercel Function Import Fix

### Fixed

- Header brand mark now uses the shared `public/favicon.svg` asset.
- Print/PDF export now collapses the surrounding workspace chrome instead of preserving hidden layout space, preventing a blank first PDF page.
- API routes now use deployment-safe `.js` import specifiers for Vercel's ESM serverless runtime.
- Gemini output validation no longer imports the full browser parser tree inside the serverless function bundle.
- Composer generation now uses only `gemini-3.1-flash-lite-preview` and returns a parseable local flute fallback if that pinned model is temporarily unavailable.
- AI-generated note text is now rejected before it reaches the editor when it uses unsupported duration tokens such as dotted values.

## 2026-04-28 - AI Structured Response Fix

### Fixed

- Gemini object-shaped API errors no longer render as `[object Object]` in the Text To Notes status area.
- Structured Gemini note responses with `measures`, `events`, `notes`, `pitch`, and `duration` fields are converted into StaffSmith notation.
- Note generation now falls back to a valid beginner flute phrase instead of reusing the old composer input when Gemini returns an unusable format.

## 2026-04-28 - AI Note Generation Guard

### Fixed

- Natural-language note generation no longer inserts `[object Object]` when Gemini returns notation inside an object.
- The default note-generation prompt is now "A flute solo for beginners, in the style of jethro tull jazz".

## 2026-04-28 - Core Test Coverage

### Added

- Vitest test runner with focused coverage for parser behavior, MusicXML export, score insights, and Gemini availability checks.
- `pnpm test` script for running the core regression suite.

## 2026-04-28 - Gemini Availability Light

### Added

- Server-side `/api/gemini-status` endpoint that pings the configured Gemini model without exposing `GEMINI_API_KEY`.
- Header Gemini availability light that checks immediately and refreshes once per hour while the app is open.

## 2026-04-28 - Compact Control Pass

### Added

- Richer Lucide icon set for header, workspace navigation, composer actions, and score preview controls.

### Changed

- Header project controls are now compact icon buttons to return horizontal and vertical space to the workspace.
- Section names, helper text, AI prompt fields, and action rows are shorter so the composer and sheet preview occupy more of the viewport.
- The A4 preview surface now uses the recovered header space for a larger white score page.

## 2026-04-28 - Composer Assist Feedback Fix

### Fixed

- Note generation now shows status and error messages directly in the "Generate Notes From Text" section.
- API calls now time out with an actionable local-development message instead of appearing to do nothing when Vercel API routes are not running.
- Composer AI prompting now converts named artist or band references into broad musical traits rather than direct style imitation.

## 2026-04-28 - Paged Workspace Refinement

### Added

- Closeable right-side Inspector drawer for Status, Score Intelligence, and Parse Details.
- Fitted score page viewer with bottom Previous / Next controls.
- Drag/swipe navigation across rendered score pages.

### Changed

- Score diagnostics no longer consume the main composer workspace.
- Score preview no longer relies on an internal scrolling sheet surface for normal page viewing.

## 2026-04-28 - Current State

### Added

- Local-first StaffSmith workspace for turning note and chord text into rendered sheet music.
- Browser rendering pipeline from StaffSmith text to typed score data, MusicXML, and OpenSheetMusicDisplay preview.
- A4 score preview with print/PDF-friendly layout and a stylized score title.
- Compact engraving defaults for more serious notation density.
- Dynamics, expressions, custom bracketed text, and hairpin syntax:
  - `pp`, `p`, `mp`, `mf`, `f`, `ff`
  - `dolce`, `legato`, `staccato`, `tenuto`, `cantabile`, `espressivo`, `rit.`, `accel.`
  - `[free text]`
  - `<` / `cresc` and `>` / `dim`
- Dedicated Syntax Help page at `#/help`.
- Shared syntax guide used by both the Help page and the Gemini composer prompt.
- AI-powered composer assistance backed by `GEMINI_API_KEY`.
- Natural-language "Generate Notes From Text" section that writes StaffSmith note syntax into Composer Input.
- Neon/Postgres persistence foundation for saving and loading projects.
- Project export, MusicXML download, copy source, copy XML, and print/PDF actions.
- Bright vivid workspace styling with clean white score sheets.
- Vercel-oriented project setup with API routes and deployment-safe environment variable examples.

### Changed

- Project Console controls now live directly in the header to free workspace space.
- Composer Input now receives the reclaimed real estate with a larger notation editor.
- Score preview no longer shows the unnecessary "Melody" subtitle or default OSMD instrument label.
- MusicXML output uses tighter page margins and compact scaling for denser A4 output.
- Help syntax content is centralized so documentation and AI prompting stay aligned.

### Verified

- `pnpm lint`
- `pnpm build`
- Chromium visual checks for the workspace, score preview, help page, and responsive layout.

### Known Notes

- Vite still reports the expected OpenSheetMusicDisplay chunk-size warning during production builds.
