import { useCallback, useDeferredValue, useEffect, useRef, useState, type PointerEvent } from 'react'
import { ChevronLeft, ChevronRight, Copy, Download, Printer, RotateCcw } from 'lucide-react'
import { SectionCard } from '../../components/SectionCard'
import {
  DEFAULT_PART_LAYOUT_PRESET,
  PART_LAYOUT_PRESETS,
  getPartLayoutPreset,
  type PartLayoutPresetId,
} from '../../music/musicxml/sheetOptions'
import './ScorePreview.css'

type ScorePreviewProps = {
  musicXml: string | null
  title: string
  partLayoutPresetId: PartLayoutPresetId
  onPartLayoutPresetChange: (presetId: PartLayoutPresetId) => void
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
}

const BASE_PREVIEW_ZOOM = 0.84
const UNTITLED_SCORE_TITLE = 'Untitled sketch'

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

function createScoreTitleBlock(title: string) {
  const titleBlock = document.createElement('header')
  titleBlock.className = 'score-title-block'

  const heading = document.createElement('h2')
  heading.textContent = title || UNTITLED_SCORE_TITLE
  titleBlock.append(heading)

  return titleBlock
}

function createScorePage(svg: SVGSVGElement, pageIndex: number, showTitle: boolean, title: string) {
  const page = document.createElement('article')
  page.className = pageIndex === 0 && showTitle ? 'score-page score-page--with-title' : 'score-page'
  page.dataset.pageIndex = String(pageIndex)
  page.setAttribute('aria-label', `Score page ${pageIndex + 1}`)

  if (pageIndex === 0 && showTitle) {
    page.append(createScoreTitleBlock(title))
  }

  const pageBody = document.createElement('div')
  pageBody.className = 'score-page__body'
  pageBody.append(svg)
  page.append(pageBody)

  return page
}

function replaceRenderTargetWithPages(container: HTMLElement, renderTarget: HTMLElement, showTitle: boolean, title: string) {
  const renderedPages = Array.from(renderTarget.querySelectorAll<SVGSVGElement>('svg'))

  if (renderedPages.length === 0) {
    container.replaceChildren(renderTarget)
    return 0
  }

  const fragment = document.createDocumentFragment()
  renderedPages.forEach((svg, index) => {
    fragment.append(createScorePage(svg, index, showTitle, title))
  })
  container.replaceChildren(fragment)

  return renderedPages.length
}

export function ScorePreview({
  musicXml,
  title,
  partLayoutPresetId,
  onPartLayoutPresetChange,
  onCopyMusicXml,
  onDownloadMusicXml,
  onPrintScore,
}: ScorePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const previewSurfaceRef = useRef<HTMLDivElement | null>(null)
  const dragStartRef = useRef<number | null>(null)
  const renderIdRef = useRef(0)
  const scrollFrameRef = useRef<number | null>(null)
  const [renderError, setRenderError] = useState<RenderError | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [showTitle, setShowTitle] = useState(true)
  const [showMeasureNumbers, setShowMeasureNumbers] = useState(true)
  const partLayoutPreset = getPartLayoutPreset(partLayoutPresetId)
  const deferredPartLayoutPreset = useDeferredValue(partLayoutPreset)
  const deferredShowMeasureNumbers = useDeferredValue(showMeasureNumbers)

  const updateRenderedPages = useCallback((resetPage = false) => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const renderedPages = container.querySelectorAll('.score-page')
    const nextPageCount = Math.max(1, renderedPages.length)
    setPageCount(nextPageCount)
    setPageIndex((current) => (resetPage ? 0 : Math.min(current, nextPageCount - 1)))
    if (resetPage) {
      previewSurfaceRef.current?.scrollTo({ top: 0, left: 0 })
    }
  }, [])

  const scrollToPage = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const container = containerRef.current
    const page = container?.querySelector<HTMLElement>(`.score-page[data-page-index="${index}"]`)
    if (!page) {
      return
    }

    page.scrollIntoView({ block: 'start', inline: 'nearest', behavior })
  }, [])

  const updateCurrentPageFromScroll = useCallback(() => {
    const surface = previewSurfaceRef.current
    if (!surface) {
      return
    }

    const pages = Array.from(surface.querySelectorAll<HTMLElement>('.score-page'))
    if (pages.length === 0) {
      return
    }

    const surfaceRect = surface.getBoundingClientRect()
    const referenceY = surfaceRect.top + Math.min(surfaceRect.height * 0.35, 180)
    const closestPage = pages
      .map((page, index) => {
        const rect = page.getBoundingClientRect()
        const distance = referenceY >= rect.top && referenceY <= rect.bottom
          ? 0
          : Math.min(Math.abs(referenceY - rect.top), Math.abs(referenceY - rect.bottom))

        return { index, distance }
      })
      .sort((a, b) => a.distance - b.distance)[0]

    if (!closestPage) {
      return
    }

    setPageIndex((current) => (current === closestPage.index ? current : closestPage.index))
  }, [])

  const handlePreviewScroll = () => {
    if (scrollFrameRef.current !== null) {
      return
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null
      updateCurrentPageFromScroll()
    })
  }

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
          pageFormat: 'A4_P',
          newPageFromXML: true,
          newSystemFromXML: true,
        })

        const spacingScale = deferredPartLayoutPreset.previewSystemSpacing / 100
        osmd.EngravingRules.MinimumDistanceBetweenSystems *= spacingScale
        osmd.EngravingRules.MinSkyBottomDistBetweenSystems *= spacingScale
        osmd.EngravingRules.RenderMeasureNumbers = deferredShowMeasureNumbers
        osmd.EngravingRules.RenderXMeasuresPerLineAkaSystem = deferredPartLayoutPreset.measuresPerSystem

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
        applyZoom(zoomableDisplay, BASE_PREVIEW_ZOOM * (deferredPartLayoutPreset.previewNoteScale / 100))
        osmd.render()
        replaceRenderTargetWithPages(container, renderTarget, showTitle, title)
        updateRenderedPages(true)
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
  }, [deferredPartLayoutPreset, deferredShowMeasureNumbers, musicXml, showTitle, title, updateRenderedPages])

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current)
    }
  }, [])

  const goToPreviousPage = () => {
    setPageIndex((current) => {
      const nextPage = Math.max(0, current - 1)
      scrollToPage(nextPage)
      return nextPage
    })
  }

  const goToNextPage = () => {
    setPageIndex((current) => {
      const nextPage = Math.min(pageCount - 1, current + 1)
      scrollToPage(nextPage)
      return nextPage
    })
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
    onPartLayoutPresetChange(DEFAULT_PART_LAYOUT_PRESET)
    setShowTitle(true)
    setShowMeasureNumbers(true)
  }

  return (
    <SectionCard title="Score" className="score-preview-card">
      <div className="preview-toolbar" aria-label="Score preview actions">
        <div className="preview-toolbar__controls">
          <div className="preview-preset-control">
            <span className="preview-control__label">Layout</span>
            <div className="preview-segmented-control" role="group" aria-label="Part layout preset">
              {PART_LAYOUT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={preset.id === partLayoutPresetId ? 'is-active' : undefined}
                  onClick={() => onPartLayoutPresetChange(preset.id)}
                  aria-pressed={preset.id === partLayoutPresetId}
                  disabled={!musicXml}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <label className="preview-toggle-control">
            <input
              type="checkbox"
              checked={showMeasureNumbers}
              onChange={(event) => setShowMeasureNumbers(event.target.checked)}
              disabled={!musicXml}
            />
            Bars
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
            className="preview-utility-button preview-icon-button"
            onClick={handleResetLayout}
            disabled={!musicXml}
            aria-label="Reset score preview layout"
            title="Reset score preview layout"
          >
            <RotateCcw size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="preview-toolbar__actions">
          <button
            type="button"
            className="preview-icon-button"
            onClick={onCopyMusicXml}
            disabled={!musicXml}
            aria-label="Copy MusicXML"
            title="Copy MusicXML"
          >
            <Copy size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="preview-icon-button"
            onClick={onDownloadMusicXml}
            disabled={!musicXml}
            aria-label="Download MusicXML"
            title="Download MusicXML"
          >
            <Download size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="preview-icon-button"
            onClick={onPrintScore}
            disabled={!musicXml}
            aria-label="Print or save PDF"
            title="Print or save PDF"
          >
            <Printer size={16} aria-hidden="true" />
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
        aria-label="A4 score pages"
        ref={previewSurfaceRef}
        onScroll={handlePreviewScroll}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <div className="score-page-stack score-engraving" ref={containerRef} />
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
