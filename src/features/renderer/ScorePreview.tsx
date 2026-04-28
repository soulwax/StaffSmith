import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { ChevronLeft, ChevronRight, Copy, Download, Printer } from 'lucide-react'
import { SectionCard } from '../../components/SectionCard'
import './ScorePreview.css'

type ScorePreviewProps = {
  musicXml: string | null
  title: string
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

export function ScorePreview({
  musicXml,
  title,
  onCopyMusicXml,
  onDownloadMusicXml,
  onPrintScore,
}: ScorePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragStartRef = useRef<number | null>(null)
  const renderIdRef = useRef(0)
  const [renderError, setRenderError] = useState<RenderError | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageCount, setPageCount] = useState(1)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const pages = Array.from(container.querySelectorAll('svg'))
    pages.forEach((page, index) => {
      page.style.display = index === pageIndex ? 'block' : 'none'
    })
  }, [pageIndex, pageCount])

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
          drawPartNames: false,
          drawPartAbbreviations: false,
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
          zoomableDisplay.setZoom(0.84)
        } else if ('Zoom' in zoomableDisplay) {
          zoomableDisplay.Zoom = 0.84
        } else {
          zoomableDisplay.zoom = 0.84
        }

        osmd.render()
        const renderedPages = renderTarget.querySelectorAll('svg')
        setPageCount(Math.max(1, renderedPages.length))
        setPageIndex(0)
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

  const goToPreviousPage = () => {
    setPageIndex((current) => Math.max(0, current - 1))
  }

  const goToNextPage = () => {
    setPageIndex((current) => Math.min(pageCount - 1, current + 1))
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = event.clientX
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current
    dragStartRef.current = null
    if (dragStart === null) {
      return
    }

    const delta = event.clientX - dragStart
    if (Math.abs(delta) < 48) {
      return
    }

    if (delta < 0) {
      goToNextPage()
    } else {
      goToPreviousPage()
    }
  }

  return (
    <SectionCard title="Score" className="score-preview-card">
      <div className="preview-toolbar" aria-label="Score preview actions">
        <button type="button" onClick={onCopyMusicXml} disabled={!musicXml} aria-label="Copy MusicXML" title="Copy MusicXML">
          <Copy size={16} aria-hidden="true" />
          XML
        </button>
        <button type="button" onClick={onDownloadMusicXml} disabled={!musicXml} aria-label="Download MusicXML" title="Download MusicXML">
          <Download size={16} aria-hidden="true" />
          XML
        </button>
        <button type="button" onClick={onPrintScore} disabled={!musicXml} aria-label="Print or save PDF" title="Print or save PDF">
          <Printer size={16} aria-hidden="true" />
          PDF
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
      <div
        className="preview-surface"
        aria-label="A4 score page"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <div className="a4-page">
          <header className="score-title-block">
            <h2>{title || 'Untitled sketch'}</h2>
          </header>
          <div className="score-engraving" ref={containerRef} />
        </div>
      </div>
      <div className="page-controls" aria-label="Score page controls">
        <button type="button" onClick={goToPreviousPage} disabled={!musicXml || pageIndex === 0} aria-label="Previous page" title="Previous page">
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
        <span>
          Page {musicXml ? pageIndex + 1 : 0} / {musicXml ? pageCount : 0}
        </span>
        <button type="button" onClick={goToNextPage} disabled={!musicXml || pageIndex >= pageCount - 1} aria-label="Next page" title="Next page">
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
    </SectionCard>
  )
}
