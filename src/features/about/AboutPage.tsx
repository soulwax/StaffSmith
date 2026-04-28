import { Code2, ExternalLink } from 'lucide-react'
import { SectionCard } from '../../components/SectionCard'
import './AboutPage.css'

export function AboutPage() {
  return (
    <SectionCard title="About">
      <div className="about-page">
        <div className="about-story">
          <p>
            By training, a neuroscientist. By vocation, a programmer. By calling, a teacher —
            delivering lectures in Amsterdam to students who still believe the brain holds a few
            unsolved mysteries.
          </p>
          <p>
            Between grading papers and git commits, there is a small girl. She reaches for the
            piano without being asked, plays notes that have no name yet, and treats every sound
            as though it deserves to exist. StaffSmith began as a question she made obvious:
            what if any note you could hum, you could also write down?
          </p>
          <p>
            This is that attempt.
          </p>
        </div>

        <div className="about-links">
          <a
            className="about-link"
            href="https://github.com/soulwax/StaffSmith"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Code2 size={15} aria-hidden="true" />
            GitHub Repository
          </a>
          <a
            className="about-link"
            href="https://legal.bluesix.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={15} aria-hidden="true" />
            Legal
          </a>
        </div>
      </div>
    </SectionCard>
  )
}
