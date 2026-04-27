import { useEffect, useRef, useState } from 'react'
import { SectionCard } from '../../components/SectionCard'
import './ScorePreview.css'

type ScorePreviewProps = {
  musicXml: string | null
}

type RenderError = {
  musicXml: string
  message: string
}

type ZoomableDisplay = {
  setZoom?: (zoom: number) => void
  Zoom?: number
  zoom?: number
}

export function ScorePreview({ musicXml }: ScorePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [renderError, setRenderError] = useState<RenderError | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    if (!musicXml) {
      container.replaceChildren()
      return
    }

    let cancelled = false
    container.replaceChildren()

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

        const zoomableDisplay = osmd as ZoomableDisplay
        if (zoomableDisplay.setZoom) {
          zoomableDisplay.setZoom(1.3)
        } else if ('Zoom' in zoomableDisplay) {
          zoomableDisplay.Zoom = 1.3
        } else {
          zoomableDisplay.zoom = 1.3
        }

        osmd.render()
        setRenderError(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown renderer error.'
        setRenderError({ musicXml, message })
        container.replaceChildren()
      }
    }

    void renderScore()

    return () => {
      cancelled = true
      container.replaceChildren()
    }
  }, [musicXml])

  return (
    <SectionCard title="Score Preview" className="score-preview-card">
      {renderError && renderError.musicXml === musicXml ? (
        <p className="preview-error">Renderer error: {renderError.message}</p>
      ) : null}
      {!musicXml ? (
        <div className="preview-placeholder">
          <p>Render a valid input to preview staff notation.</p>
        </div>
      ) : null}
      <div className="preview-surface" ref={containerRef} />
    </SectionCard>
  )
}
