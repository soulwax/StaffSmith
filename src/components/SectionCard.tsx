import type { ReactNode } from 'react'
import './SectionCard.css'

type SectionCardProps = {
  title: string
  children: ReactNode
  tone?: 'default' | 'success' | 'danger'
}

export function SectionCard({ title, children, tone = 'default' }: SectionCardProps) {
  return (
    <section className={`section-card section-card--${tone}`}>
      <div className="section-card__header">
        <h2>{title}</h2>
      </div>
      <div className="section-card__content">{children}</div>
    </section>
  )
}
