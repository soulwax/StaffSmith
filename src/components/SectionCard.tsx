import type { ReactNode } from 'react'
import './SectionCard.css'

type SectionCardProps = {
  title: string
  children: ReactNode
  tone?: 'default' | 'success' | 'danger'
  className?: string
}

export function SectionCard({ title, children, tone = 'default', className }: SectionCardProps) {
  const classes = ['section-card', `section-card--${tone}`, className].filter(Boolean).join(' ')

  return (
    <section className={classes}>
      <div className="section-card__header">
        <h2>{title}</h2>
      </div>
      <div className="section-card__content">{children}</div>
    </section>
  )
}
