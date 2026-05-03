# StaffScript v0.1

StaffScript is StaffSmith's official readable text notation language. It is designed for quick human entry, stable parser tests, MusicXML export, and future AI-assisted composition. Preferred file extension: `.staff`; `.staff.txt` is fine for examples and plain-text sharing.

## Quick Example

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

## Metadata

Metadata directives may appear on their own lines before the music:

```staff
@version=0.1
@title="Title"
@composer="Composer"
@instrument=flute
@clef=treble
@tempo=120
@time=5/4
@key=Dm
@mode=notes
@dur=q
```

Supported keys are `version`, `title`, `composer`, `instrument`, `clef`, `tempo`, `time`, `key`, `mode`, and `dur`. Unknown keys are preserved in score metadata where reasonable and do not crash parsing.

The notation trinity is optional. If it is omitted, StaffSmith renders treble/violin clef, no key signature, and 4/4.

`@clef` accepts `treble`, `violin`, `bass`, `alto`, and `tenor`.

`@key` accepts all conventional key signatures by name, including `C`, `Dm`, `B-flat minor`, `F# major`, and direct fifth counts from `-7` to `7`. Values like `none`, `open`, and `atonal` render no key signature.

`@time` accepts values like `4/4`, `5/4`, `6/8`, `7/8`, and `12/8`, plus `common` and `cut`.

`@tempo` accepts 20-300 BPM. `@mode` accepts `notes` or `chords`. `@dur` sets the default duration for notes and rests.

## Notes, Rests, Durations

Pitches use note name plus octave:

```staff
C4 q, F#5 8, Bb5 h
```

Rests use `R`, `rest`, or `pause`:

```staff
R w | rest q, pause h
```

Durations are `w`, `h`, `q`, `8`, `16`, and `32`. Omitted durations use `@dur` when present, otherwise `q`.

## Bars and Slurs

Use `|` as a bar line. Use spaced parentheses for slurs:

```staff
( C4 8, D4 8, E4 q ) pause q, G4 h
```

Slurs attach to notes only, not rests.

## Dynamics and Expressions

Dynamics: `pp`, `p`, `mp`, `mf`, `f`, `ff`.

Hairpins: `<`, `cresc`, `cresc.`, `>`, `dim`, `dim.`, `decresc`, `decresc.`, `diminuendo`.

Built-in expressions: `dolce`, `legato`, `staccato`, `tenuto`, `cantabile`, `espressivo`, `rit.`, `accel.`, `a-tempo`, `tempo`.

Bracketed expressions remain free-form:

```staff
[freestyle] [cadenza-like] [warm tone]
```

## Sections

Formal sections create section markers and parse their contents:

```staff
section intro {
  D5 q, F5 q, A5 h
}
```

Inline labels remain valid:

```staff
[intro] D5 q, F5 q, A5 h
```

Section blocks can also be referenced with `use sectionName` when no motif with that name exists. If a motif and section share a name, the motif wins.

## Motifs

Motifs are reusable phrases:

```staff
@motif intro = ( D5 q, F5 q, A5 h )
@motif fall = G5 q, F5 q, E5 q, D5 q

use intro
use fall
```

Compact aliases are supported:

```staff
@intro = ( D5 q, F5 q, A5 h )
use intro
```

Motifs may include bars, slurs, dynamics, expressions, rests, and other motif uses. Missing motifs and recursive motifs produce parse errors.

## Repeats

Repeat blocks expand into repeated notation:

```staff
repeat 2 {
  D5 q, F5 q, A5 h
}

x2 {
  G5 q, F5 q, E5 q, D5 q
}
```

Repeat counts must be positive integers.

## Chord Mode

Chord mode supports a documented lead-sheet subset:

```staff
@mode=chords
C | Cm | Cmaj7 | Cmin7 | C7 | Cm7
Cdim | Caug | Csus4 | Cadd9 | F#dim | Bbmaj7
mf Cmaj7 | < Am7 | Dm7 G7 | p Cmaj7
```

Chord mode distributes up to four chord symbols across a measure. Dynamics, expressions, and hairpins are accepted.

## Grammar Sketch

```text
document       := metadata* statement*
metadata       := "@" key "=" value | "@motif" name "=" phrase | "@" name "=" phrase
statement      := section | repeat | use | phrase
section        := "section" name "{" statement* "}"
repeat         := ("repeat" integer | "x" integer) "{" statement* "}"
use            := "use" name
phrase         := item (separator item)*
item           := direction | slur | note | rest | chord
note           := pitch duration?
rest           := ("R" | "rest" | "pause") duration?
pitch          := [A-G] accidental? octave
duration       := "w" | "h" | "q" | "8" | "16" | "32"
direction      := dynamic | expression | hairpin | "[" text "]"
separator      := "," | "|"
```

## Current Limitations

- Notes mode is still monophonic.
- Tuplets, ties, articulations as note notations, lyrics, beams by author intent, and multi-track arrangements are not implemented.
- Chord mode is a clean subset, not a full jazz harmony parser.
- MusicXML export prioritizes graceful rendering over perfect engraving semantics.
- Section and motif expansion is intentionally simple and deterministic.

## Roadmap

Future StaffScript work may add MIDI export, MusicXML polish, relative pitch, richer articulation export, humanization, DAW export, AI-assisted composition, multi-track arrangements, and better project/sample synchronization.
