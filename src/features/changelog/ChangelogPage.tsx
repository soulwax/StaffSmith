import { useEffect, useState } from 'react'
import { SectionCard } from '../../components/SectionCard'
import './ChangelogPage.css'

type ChangelogState =
  | { status: 'loading'; text: string }
  | { status: 'ready'; text: string }
  | { status: 'error'; text: string }

function renderInlineText(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index}>{part.slice(1, -1)}</code>
    }

    return part
  })
}

function renderMarkdownLine(line: string, index: number) {
  if (line.startsWith('# ')) {
    return <h1 key={index}>{renderInlineText(line.slice(2))}</h1>
  }

  if (line.startsWith('## ')) {
    return <h2 key={index}>{renderInlineText(line.slice(3))}</h2>
  }

  if (line.startsWith('### ')) {
    return <h3 key={index}>{renderInlineText(line.slice(4))}</h3>
  }

  const trimmed = line.trim()
  if (trimmed.startsWith('- ')) {
    return (
      <p key={index} className={line.startsWith('  ') ? 'changelog-bullet changelog-bullet--nested' : 'changelog-bullet'}>
        {renderInlineText(trimmed.slice(2))}
      </p>
    )
  }

  if (!trimmed) {
    return <span key={index} className="changelog-gap" aria-hidden="true" />
  }

  return <p key={index}>{renderInlineText(line)}</p>
}

export function ChangelogPage() {
  const [state, setState] = useState<ChangelogState>({ status: 'loading', text: '' })

  useEffect(() => {
    let cancelled = false

    const loadChangelog = async () => {
      try {
        const response = await fetch('/CHANGELOG.md', { cache: 'no-cache' })
        if (!response.ok) {
          throw new Error('Changelog is not available yet.')
        }

        const text = await response.text()
        if (!cancelled) {
          setState({ status: 'ready', text })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            text: error instanceof Error ? error.message : 'Changelog could not be loaded.',
          })
        }
      }
    }

    void loadChangelog()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <SectionCard title="Changelog">
      <article className="changelog-page">
        {state.status === 'loading' ? <p className="muted">Loading changelog...</p> : null}
        {state.status === 'error' ? <p className="preview-error">{state.text}</p> : null}
        {state.status === 'ready' ? state.text.split(/\r?\n/).map(renderMarkdownLine) : null}
      </article>
    </SectionCard>
  )
}
