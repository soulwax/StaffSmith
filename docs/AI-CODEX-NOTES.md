# AI / Codex Notes

StaffScript is StaffSmith's official notation language. Treat `docs/StaffScript-v0.1.md` as the source of truth for syntax.

## Architecture Rules

- Keep the parser layer renderer-agnostic and testable.
- MusicXML remains the canonical export and rendering target.
- Do not make OpenSheetMusicDisplay a parser dependency.
- Do not replace React, Vite, or the current MusicXML rendering architecture.
- Preserve old note and chord syntax unless a task explicitly asks for a breaking language revision.

## Change Checklist

When syntax changes, update these together:

- parser/preprocessor code in `src/music/parser`
- score model types if the contract truly changes
- MusicXML conversion if export needs new metadata or events
- editor examples in `src/features/editor/examples.ts`
- syntax help UI
- README syntax notes
- `docs/StaffScript-v0.1.md`
- parser/MusicXML tests
- sample exports only when the sample project itself changes

## MVP Guardrails

- Keep StaffScript v0.1 deterministic and small.
- Keep durations to `w`, `h`, `q`, `8`, `16`, and `32` unless explicitly expanding the language.
- Keep chord mode to the documented subset before attempting full jazz harmony.
- Prefer graceful degradation in MusicXML over parser crashes.
- Keep AI-generated notation readable: complete measures, clear bars, intentional rests, and section structure.

## Future Goals

Planned directions include MIDI export, MusicXML polish, relative pitch, humanization, DAW export, AI-assisted composition, multi-track arrangements, richer articulations, and stronger project export/import workflows.
