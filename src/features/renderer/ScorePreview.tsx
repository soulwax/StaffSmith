import { useEffect, useRef, useState } from 'react'
import { SectionCard } from '../../components/SectionCard'
import './ScorePreview.css'

type ScorePreviewProps = {
  musicXml: string | null
  onCopyMusicXml: () => void
  onDownloadMusicXml: () => void
  onPrintScore: () => void
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

export function ScorePreview({ musicXml, onCopyMusicXml, onDownloadMusicXml, onPrintScore }: ScorePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const renderIdRef = useRef(0)
  const [renderError, setRenderError] = useState<RenderError | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    if (!musicXml) {
      renderIdRef.current += 1
      container.replaceChildren()
      return
    }

    let cancelled = false
    const renderId = renderIdRef.current + 1
    renderIdRef.current = renderId
    container.replaceChildren()

    const renderScore = async () => {
      try {
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')
        if (cancelled || renderId !== renderIdRef.current) {
          return
        }

        const renderTarget = document.createElement('div')
        renderTarget.className = 'preview-render-target'
        container.replaceChildren(renderTarget)

        const osmd = new OpenSheetMusicDisplay(renderTarget, {
          autoResize: true,
          drawTitle: false,
          backend: 'svg',
          pageFormat: 'A4',
        })

        await osmd.load(musicXml)
        if (cancelled) {
          renderTarget.remove()
          return
        }

        if (renderId !== renderIdRef.current) {
          renderTarget.remove()
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
      if (renderId === renderIdRef.current) {
        container.replaceChildren()
      }
    }
  }, [musicXml])

  return (
    <SectionCard title="Score Preview" className="score-preview-card">
      <div className="preview-toolbar" aria-label="Score preview actions">
        <button type="button" onClick={onCopyMusicXml} disabled={!musicXml}>
          Copy XML
        </button>
        <button type="button" onClick={onDownloadMusicXml} disabled={!musicXml}>
          Download XML
        </button>
        <button type="button" onClick={onPrintScore} disabled={!musicXml}>
          Print / PDF
        </button>
      </div>
      {renderError && renderError.musicXml === musicXml ? (
        <p className="preview-error">Renderer error: {renderError.message}</p>
      ) : null}
      {!musicXml ? (
        <div className="preview-placeholder">
          <p>Render a valid input to preview staff notation.</p>
        </div>
      ) : null}
      <div className="preview-surface" aria-label="A4 score page">
        <div className="a4-page" ref={containerRef} />
      </div>
    </SectionCard>
  )
}
