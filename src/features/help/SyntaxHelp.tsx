import { SectionCard } from '../../components/SectionCard'
import {
  CHORD_SYNTAX_EXAMPLES,
  DYNAMIC_TOKENS,
  EXPRESSION_TOKENS,
  HAIRPIN_TOKENS,
  NOTE_SYNTAX_EXAMPLES,
} from '../../music/parser/syntaxGuide'
import './SyntaxHelp.css'

export function SyntaxHelp() {
  return (
    <SectionCard title="StaffScript Syntax">
      <div className="syntax-help">
        <div>
          <h3>Metadata</h3>
          <p>Place optional directives before the music.</p>
          <code>@version=0.1</code>
          <code>@title="Sketch"</code>
          <code>@tempo=120</code>
          <code>@time=5/4</code>
          <code>@dur=q</code>
        </div>
        <div>
          <h3>Notes</h3>
          <p>Use pitch+octave with optional duration.</p>
          <code>C4 q</code>
          <code>F#3 h</code>
          <code>Bb5 8</code>
          <code>G5 16</code>
          <code>A5 32</code>
        </div>
        <div>
          <h3>Pauses</h3>
          <p>Use R, rest, or pause with optional duration.</p>
          <code>R w</code>
          <code>rest q</code>
          <code>pause 8</code>
        </div>
        <div>
          <h3>Slurs</h3>
          <p>Use parentheses around notes for smooth transitions.</p>
          <code>( C4 q, D4 q )</code>
          <code>( E4 8, F4 8, G4 h )</code>
        </div>
        <div>
          <h3>Chords</h3>
          <p>Use common lead-sheet symbols.</p>
          <code>C</code>
          <code>Cm</code>
          <code>Cmaj7</code>
          <code>Cadd9</code>
          <code>F#dim</code>
        </div>
        <div>
          <h3>Sections</h3>
          <p>Use named blocks or inline labels.</p>
          <code>section intro {'{'} D5 q {'}'}</code>
          <code>[intro] D5 q</code>
        </div>
        <div>
          <h3>Motifs</h3>
          <p>Define a phrase once and reuse it.</p>
          <code>@motif intro = ( D5 q, F5 q )</code>
          <code>@intro = ( D5 q, F5 q )</code>
          <code>use intro</code>
        </div>
        <div>
          <h3>Repeats</h3>
          <p>Repeat a block by count.</p>
          <code>repeat 2 {'{'} D5 q, F5 q {'}'}</code>
          <code>x2 {'{'} D5 q, F5 q {'}'}</code>
        </div>
        <div>
          <h3>Dynamics</h3>
          <p>Place before a note or chord.</p>
          {DYNAMIC_TOKENS.map((entry) => <code key={entry}>{entry}</code>)}
        </div>
        <div>
          <h3>Expression</h3>
          <p>Use built-ins or bracketed text.</p>
          {EXPRESSION_TOKENS.map((entry) => <code key={entry}>{entry}</code>)}
        </div>
        <div>
          <h3>Volume Change</h3>
          <p>Use hairpin shorthand or words.</p>
          {HAIRPIN_TOKENS.map((entry) => <code key={entry}>{entry}</code>)}
        </div>
        <div>
          <h3>Tempo</h3>
          <p>Set BPM in the metadata header (20-300).</p>
          <code>@tempo=120</code>
          <code>@tempo=72</code>
        </div>
        <div>
          <h3>Bars</h3>
          <p>Separate measures with a bar line.</p>
          <code>|</code>
        </div>
      </div>
      <div className="syntax-examples">
        <div>
          <strong>StaffScript notes</strong>
          {NOTE_SYNTAX_EXAMPLES.map((example) => <code key={example}>{example}</code>)}
        </div>
        <div>
          <strong>StaffScript chords</strong>
          {CHORD_SYNTAX_EXAMPLES.map((example) => <code key={example}>{example}</code>)}
        </div>
      </div>
    </SectionCard>
  )
}
