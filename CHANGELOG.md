# Changelog

All notable StaffSmith changes will be documented in this file.

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
