import { SectionCard } from '../../components/SectionCard'
import './SyntaxHelp.css'

const noteExamples = ['C4 q, E4 q, G4 h', 'mf C4 q, D4 q, < E4 h', '[dolce] C5 q | p B4 h']
const chordExamples = ['Cmaj7 | Am7 | Dm7 G7 | Cmaj7', 'mf C | < Am7 | > Dm7 G7 | p Cmaj7']
const dynamics = ['pp', 'p', 'mp', 'mf', 'f', 'ff']
const expressions = ['dolce', 'legato', 'staccato', 'tenuto', 'cantabile', 'espressivo', 'rit.', 'accel.', '[free text]']
const changes = ['< or cresc', '> or dim']

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
          {dynamics.map((entry) => <code key={entry}>{entry}</code>)}
        </div>
        <div>
          <h3>Expression</h3>
          <p>Use built-ins or bracketed text.</p>
          {expressions.map((entry) => <code key={entry}>{entry}</code>)}
        </div>
        <div>
          <h3>Volume Change</h3>
          <p>Use hairpin shorthand or words.</p>
          {changes.map((entry) => <code key={entry}>{entry}</code>)}
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
          {noteExamples.map((example) => <code key={example}>{example}</code>)}
        </div>
        <div>
          <strong>Chords mode</strong>
          {chordExamples.map((example) => <code key={example}>{example}</code>)}
        </div>
      </div>
    </SectionCard>
  )
}
