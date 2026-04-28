import { useCallback, useDeferredValue, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { ChevronLeft, ChevronRight, Copy, Download, Printer, RotateCcw } from 'lucide-react'
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
  EngravingRules: {
    MinimumDistanceBetweenSystems: number
    MinSkyBottomDistBetweenSystems: number
    RenderMeasureNumbers: boolean
    RenderXMeasuresPerLineAkaSystem: number
  }
  updateGraphic: () => void
  render: () => void
}

type EngravingDefaults = {
  minimumDistanceBetweenSystems: number
  minSkyBottomDistBetweenSystems: number
}

const BASE_PREVIEW_ZOOM = 0.84
const DEFAULT_NOTE_SCALE = 100
const DEFAULT_SYSTEM_SPACING = 100
const DEFAULT_MEASURES_PER_LINE = 0
const MEASURES_PER_LINE_OPTIONS = [
  { label: 'Auto', value: 0 },
  { label: '2 / line', value: 2 },
  { label: '3 / line', value: 3 },
  { label: '4 / line', value: 4 },
  { label: '5 / line', value: 5 },
] as const

function applyZoom(display: ZoomableDisplay, zoom: number) {
  if (display.setZoom) {
    display.setZoom(zoom)
    return
  }

  if ('Zoom' in display) {
    display.Zoom = zoom
    return
  }

  display.zoom = zoom
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
  const osmdRef = useRef<ZoomableDisplay | null>(null)
  const engravingDefaultsRef = useRef<EngravingDefaults | null>(null)
  const [renderError, setRenderError] = useState<RenderError | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [noteScale, setNoteScale] = useState(DEFAULT_NOTE_SCALE)
  const [systemSpacing, setSystemSpacing] = useState(DEFAULT_SYSTEM_SPACING)
  const [measuresPerLine, setMeasuresPerLine] = useState(DEFAULT_MEASURES_PER_LINE)
  const [showTitle, setShowTitle] = useState(true)
  const [showMeasureNumbers, setShowMeasureNumbers] = useState(true)
  const deferredSystemSpacing = useDeferredValue(systemSpacing)
  const deferredMeasuresPerLine = useDeferredValue(measuresPerLine)
  const deferredShowMeasureNumbers = useDeferredValue(showMeasureNumbers)
  const deferredSystemSpacingRef = useRef(deferredSystemSpacing)
  const deferredMeasuresPerLineRef = useRef(deferredMeasuresPerLine)
  const deferredShowMeasureNumbersRef = useRef(deferredShowMeasureNumbers)

  useEffect(() => {
    deferredSystemSpacingRef.current = deferredSystemSpacing
  }, [deferredSystemSpacing])

  useEffect(() => {
    deferredMeasuresPerLineRef.current = deferredMeasuresPerLine
  }, [deferredMeasuresPerLine])

  useEffect(() => {
    deferredShowMeasureNumbersRef.current = deferredShowMeasureNumbers
  }, [deferredShowMeasureNumbers])

  const updateRenderedPages = useCallback((resetPage = false) => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const renderedPages = container.querySelectorAll('svg')
    const nextPageCount = Math.max(1, renderedPages.length)
    setPageCount(nextPageCount)
    setPageIndex((current) => (resetPage ? 0 : Math.min(current, nextPageCount - 1)))
  }, [])

  const refreshPreviewLayout = useCallback((resetPage = false) => {
    const display = osmdRef.current
    const defaults = engravingDefaultsRef.current
    if (!display || !defaults) {
      return
    }

    const spacingScale = deferredSystemSpacingRef.current / 100
    display.EngravingRules.MinimumDistanceBetweenSystems = defaults.minimumDistanceBetweenSystems * spacingScale
    display.EngravingRules.MinSkyBottomDistBetweenSystems = defaults.minSkyBottomDistBetweenSystems * spacingScale
    display.EngravingRules.RenderMeasureNumbers = deferredShowMeasureNumbersRef.current
    display.EngravingRules.RenderXMeasuresPerLineAkaSystem = deferredMeasuresPerLineRef.current
    display.updateGraphic()
    display.render()
    updateRenderedPages(resetPage)
  }, [updateRenderedPages])

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
      osmdRef.current = null
      engravingDefaultsRef.current = null
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
        osmdRef.current = zoomableDisplay
        engravingDefaultsRef.current = {
          minimumDistanceBetweenSystems: zoomableDisplay.EngravingRules.MinimumDistanceBetweenSystems,
          minSkyBottomDistBetweenSystems: zoomableDisplay.EngravingRules.MinSkyBottomDistBetweenSystems,
        }
        applyZoom(zoomableDisplay, BASE_PREVIEW_ZOOM)
        refreshPreviewLayout(true)
        setRenderError(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown renderer error.'
        setRenderError({ musicXml, message })
        osmdRef.current = null
        engravingDefaultsRef.current = null
        container.replaceChildren()
      }
    }

    void renderScore()

    return () => {
      cancelled = true
      if (renderId === renderIdRef.current) {
        osmdRef.current = null
        engravingDefaultsRef.current = null
        container.replaceChildren()
      }
    }
  }, [musicXml, refreshPreviewLayout])

  useEffect(() => {
    if (!musicXml) {
      return
    }

    refreshPreviewLayout()
  }, [deferredMeasuresPerLine, deferredShowMeasureNumbers, deferredSystemSpacing, musicXml, refreshPreviewLayout])

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

    if (event.currentTarget.scrollWidth > event.currentTarget.clientWidth + 8) {
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

  const handleResetLayout = () => {
    setNoteScale(DEFAULT_NOTE_SCALE)
    setSystemSpacing(DEFAULT_SYSTEM_SPACING)
    setMeasuresPerLine(DEFAULT_MEASURES_PER_LINE)
    setShowTitle(true)
    setShowMeasureNumbers(true)
  }

  const previewPageStyle = {
    '--preview-page-width-factor': `${noteScale / 100}`,
  } as CSSProperties

  return (
    <SectionCard title="Score" className="score-preview-card">
      <div className="preview-toolbar" aria-label="Score preview actions">
        <div className="preview-toolbar__controls">
          <label className="preview-range-control">
            <span className="preview-control__meta">
              <span className="preview-control__label">Note size</span>
              <span className="preview-control__value">{noteScale}%</span>
            </span>
            <input
              type="range"
              min="75"
              max="140"
              step="5"
              value={noteScale}
              onChange={(event) => setNoteScale(Number(event.target.value))}
              aria-label="Adjust note preview size"
              disabled={!musicXml}
            />
          </label>

          <label className="preview-range-control">
            <span className="preview-control__meta">
              <span className="preview-control__label">Line spacing</span>
              <span className="preview-control__value">{systemSpacing}%</span>
            </span>
            <input
              type="range"
              min="80"
              max="180"
              step="10"
              value={systemSpacing}
              onChange={(event) => setSystemSpacing(Number(event.target.value))}
              aria-label="Adjust spacing between notation lines"
              disabled={!musicXml}
            />
          </label>

          <label className="preview-select-control">
            <span className="preview-control__label">Measures / line</span>
            <select
              value={measuresPerLine}
              onChange={(event) => setMeasuresPerLine(Number(event.target.value))}
              aria-label="Set measures per notation line"
              disabled={!musicXml}
            >
              {MEASURES_PER_LINE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="preview-toggle-control">
            <input
              type="checkbox"
              checked={showMeasureNumbers}
              onChange={(event) => setShowMeasureNumbers(event.target.checked)}
              disabled={!musicXml}
            />
            Bar numbers
          </label>

          <label className="preview-toggle-control">
            <input
              type="checkbox"
              checked={showTitle}
              onChange={(event) => setShowTitle(event.target.checked)}
              disabled={!musicXml}
            />
            Title
          </label>

          <button
            type="button"
            className="preview-utility-button"
            onClick={handleResetLayout}
            disabled={!musicXml}
            aria-label="Reset score preview layout"
            title="Reset score preview layout"
          >
            <RotateCcw size={15} aria-hidden="true" />
            Reset
          </button>
        </div>

        <div className="preview-toolbar__actions">
          <button type="button" onClick={onCopyMusicXml} disabled={!musicXml} aria-label="Copy MusicXML" title="Copy MusicXML">
            <Copy size={16} aria-hidden="true" />
            Copy XML
          </button>
          <button type="button" onClick={onDownloadMusicXml} disabled={!musicXml} aria-label="Download MusicXML" title="Download MusicXML">
            <Download size={16} aria-hidden="true" />
            Export XML
          </button>
          <button type="button" onClick={onPrintScore} disabled={!musicXml} aria-label="Print or save PDF" title="Print or save PDF">
            <Printer size={16} aria-hidden="true" />
            Print PDF
          </button>
        </div>
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
        <div className="a4-page" style={previewPageStyle}>
          {showTitle ? (
            <header className="score-title-block">
              <h2>{title || 'Untitled sketch'}</h2>
            </header>
          ) : null}
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
