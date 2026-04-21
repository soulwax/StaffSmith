import { useEffect, useRef, useState } from 'react'
import { SectionCard } from '../../components/SectionCard'
import './ScorePreview.css'

type ScorePreviewProps = {
  musicXml: string | null
}

export function ScorePreview({ musicXml }: ScorePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    if (!musicXml) {
      container.replaceChildren()
      setRenderError(null)
      return
    }

    let cancelled = false

    const renderScore = async () => {
      try {
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')
        const osmd = new OpenSheetMusicDisplay(container, {
          autoResize: true,
          drawTitle: false,
          backend: 'svg',
        })

        await osmd.load(musicXml)
        if (cancelled) {
          return
        }

        osmd.render()
        setRenderError(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown renderer error.'
        setRenderError(message)
        container.replaceChildren()
      }
    }

    void renderScore()

    return () => {
      cancelled = true
    }
  }, [musicXml])

  return (
    <SectionCard title="Score Preview">
      {renderError ? <p className="preview-error">Renderer error: {renderError}</p> : null}
      {!musicXml ? (
        <div className="preview-placeholder">
          <p>Render a valid input to preview staff notation.</p>
        </div>
      ) : null}
      <div className="preview-surface" ref={containerRef} />
    </SectionCard>
  )
}
