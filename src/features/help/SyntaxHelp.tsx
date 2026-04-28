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
    <SectionCard title="Syntax Help">
      <div className="syntax-help">
        <div>
          <h3>Notes</h3>
          <p>Use pitch+octave with optional duration.</p>
          <code>C4 q</code>
          <code>F#3 h</code>
          <code>Bb5 8</code>
        </div>
        <div>
          <h3>Chords</h3>
          <p>Use common lead-sheet symbols.</p>
          <code>C</code>
          <code>Cm</code>
          <code>Cmaj7</code>
          <code>F#dim</code>
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
          <h3>Bars</h3>
          <p>Separate measures with a bar line.</p>
          <code>|</code>
        </div>
      </div>
      <div className="syntax-examples">
        <div>
          <strong>Notes mode</strong>
          {NOTE_SYNTAX_EXAMPLES.map((example) => <code key={example}>{example}</code>)}
        </div>
        <div>
          <strong>Chords mode</strong>
          {CHORD_SYNTAX_EXAMPLES.map((example) => <code key={example}>{example}</code>)}
        </div>
      </div>
    </SectionCard>
  )
}
