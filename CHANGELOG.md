# Changelog

All notable StaffSmith changes will be documented in this file.

## 2026-04-28 - Vercel Function Import Fix

### Fixed

- Header brand mark now uses the shared `public/favicon.svg` asset.
- Print/PDF export now collapses the surrounding workspace chrome instead of preserving hidden layout space, preventing a blank first PDF page.
- API routes now use deployment-safe `.js` import specifiers for Vercel's ESM serverless runtime.
- Gemini output validation no longer imports the full browser parser tree inside the serverless function bundle.
- Composer generation now uses only `gemini-3.1-flash-lite-preview` and returns a parseable local flute fallback if that pinned model is temporarily unavailable.

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
