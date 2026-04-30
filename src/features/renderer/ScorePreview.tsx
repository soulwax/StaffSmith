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
const MIN_ENGRAVING_WIDTH = 720
const PRINT_RENDER_WIDTH = 720
const UNTITLED_SCORE_TITLE = 'Untitled sketch'
const PRINT_PAGE_WIDTH_MM = 210
const PRINT_PAGE_HEIGHT_MM = 297
const PRINT_PAGE_MARGIN_MM = 12
const PRINT_TOP_PADDING_UNITS = 18
const PRINT_BOTTOM_PADDING_UNITS = 18
const PRINT_SYSTEM_GAP_UNITS = 30
const PRINT_TITLE_HEIGHT_UNITS = 62

type SvgBox = {
  x: number
  y: number
  width: number
  height: number
}

type PrintSystemBlock = {
  elements: SVGElement[]
  box: SvgBox
}

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

function createScorePageShell(showTitle: boolean, title: string) {
  const page = document.createElement('article')
  page.className = showTitle ? 'score-page score-page--with-title' : 'score-page'
  page.dataset.pageIndex = '0'
  page.dataset.active = 'true'
  page.setAttribute('aria-label', 'Score page')
  page.setAttribute('aria-hidden', 'false')

  if (showTitle) {
    page.append(createScoreTitleBlock(title))
  }

  const pageBody = document.createElement('div')
  pageBody.className = 'score-page__body'
  const renderTarget = document.createElement('div')
  renderTarget.className = 'preview-render-target'
  pageBody.append(renderTarget)
  page.append(pageBody)

  return { page, renderTarget }
}

function createPrintScorePage(svg: SVGSVGElement) {
  const page = document.createElement('article')
  page.className = 'score-print-page'
  page.setAttribute('aria-hidden', 'true')

  const body = document.createElement('div')
  body.className = 'score-print-page__body'
  body.append(svg.cloneNode(true))
  page.append(body)

  return page
}

function getSvgViewBox(svg: SVGSVGElement): SvgBox {
  const viewBox = svg.viewBox.baseVal
  if (viewBox.width > 0 && viewBox.height > 0) {
    return {
      x: viewBox.x,
      y: viewBox.y,
      width: viewBox.width,
      height: viewBox.height,
    }
  }

  const width = Number.parseFloat(svg.getAttribute('width') ?? '')
  const height = Number.parseFloat(svg.getAttribute('height') ?? '')

  return {
    x: 0,
    y: 0,
    width: Number.isFinite(width) && width > 0 ? width : 840,
    height: Number.isFinite(height) && height > 0 ? height : 1188,
  }
}

function getSvgElementBox(element: SVGElement): SvgBox | null {
  if (!(element instanceof SVGGraphicsElement)) {
    return null
  }

  try {
    const box = element.getBBox()
    if (box.width === 0 && box.height === 0) {
      return null
    }

    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    }
  } catch {
    return null
  }
}

function unionSvgBoxes(boxes: SvgBox[]): SvgBox {
  const minX = Math.min(...boxes.map((box) => box.x))
  const minY = Math.min(...boxes.map((box) => box.y))
  const maxX = Math.max(...boxes.map((box) => box.x + box.width))
  const maxY = Math.max(...boxes.map((box) => box.y + box.height))

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

function collectPrintSystemBlocks(svg: SVGSVGElement): PrintSystemBlock[] {
  const topLevelElements = Array.from(svg.children).filter((child): child is SVGElement => child instanceof SVGElement)
  const systems = topLevelElements
    .map((element) => ({
      element,
      box: getSvgElementBox(element),
    }))
    .filter((item): item is { element: SVGElement, box: SvgBox } => (
      item.box !== null && item.element.classList.contains('staffline')
    ))
    .sort((a, b) => a.box.y - b.box.y)

  if (systems.length === 0) {
    const box = getSvgElementBox(svg)
    return box ? [{ elements: [svg], box }] : []
  }

  const systemCenters = systems.map((system) => system.box.y + system.box.height / 2)
  const assigned = systems.map((system) => ({
    elements: [system.element],
    boxes: [system.box],
  }))

  for (const element of topLevelElements) {
    if (element.classList.contains('staffline')) {
      continue
    }

    const box = getSvgElementBox(element)
    if (!box) {
      continue
    }

    const centerY = box.y + box.height / 2
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY

    systemCenters.forEach((systemCenter, index) => {
      const distance = Math.abs(centerY - systemCenter)
      if (distance < nearestDistance) {
        nearestIndex = index
        nearestDistance = distance
      }
    })

    assigned[nearestIndex]?.elements.push(element)
    assigned[nearestIndex]?.boxes.push(box)
  }

  return assigned.map((system) => ({
    elements: system.elements,
    box: unionSvgBoxes(system.boxes),
  }))
}

function createPrintPageSvg(sourceViewBox: SvgBox, showTitle: boolean, title: string) {
  const pageHeight = getPrintSvgPageHeight(sourceViewBox.width)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.classList.add('score-print-page-svg')
  svg.setAttribute('viewBox', `${formatSvgNumber(sourceViewBox.x)} ${formatSvgNumber(sourceViewBox.y)} ${formatSvgNumber(sourceViewBox.width)} ${formatSvgNumber(pageHeight)}`)
  svg.setAttribute('preserveAspectRatio', 'xMidYMin meet')
  svg.setAttribute('width', formatSvgNumber(sourceViewBox.width))
  svg.setAttribute('height', formatSvgNumber(pageHeight))
  svg.setAttribute('aria-hidden', 'true')

  if (showTitle) {
    const titleText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    titleText.classList.add('score-print-title')
    titleText.setAttribute('x', formatSvgNumber(sourceViewBox.x + sourceViewBox.width / 2))
    titleText.setAttribute('y', formatSvgNumber(sourceViewBox.y + 34))
    titleText.setAttribute('text-anchor', 'middle')
    titleText.textContent = title || UNTITLED_SCORE_TITLE
    svg.append(titleText)
  }

  return svg
}

function appendSystemBlock(svg: SVGSVGElement, block: PrintSystemBlock, targetY: number) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  group.classList.add('score-print-system')
  group.setAttribute('transform', `translate(0 ${formatSvgNumber(targetY - block.box.y)})`)
  block.elements.forEach((element) => {
    group.append(element.cloneNode(true))
  })
  svg.append(group)
}

function buildPrintPageSvgs(renderTarget: HTMLElement, showTitle: boolean, title: string): SVGSVGElement[] {
  const sourcePages = getRenderedPageSvgs(renderTarget)
  if (sourcePages.length === 0) {
    return []
  }

  const sourceViewBox = getSvgViewBox(sourcePages[0]!)
  const pageHeight = getPrintSvgPageHeight(sourceViewBox.width)
  const bottomLimit = sourceViewBox.y + pageHeight - PRINT_BOTTOM_PADDING_UNITS
  const blocks = sourcePages.flatMap(collectPrintSystemBlocks)
  const pages: SVGSVGElement[] = []
  let page = createPrintPageSvg(sourceViewBox, showTitle, title)
  let cursorY = sourceViewBox.y + PRINT_TOP_PADDING_UNITS + (showTitle ? PRINT_TITLE_HEIGHT_UNITS : 0)
  let systemCountOnPage = 0

  for (const block of blocks) {
    const gap = systemCountOnPage > 0 ? PRINT_SYSTEM_GAP_UNITS : 0
    const targetY = cursorY + gap

    if (systemCountOnPage > 0 && targetY + block.box.height > bottomLimit) {
      pages.push(page)
      page = createPrintPageSvg(sourceViewBox, false, title)
      cursorY = sourceViewBox.y + PRINT_TOP_PADDING_UNITS
      systemCountOnPage = 0
    }

    const nextTargetY = systemCountOnPage > 0 ? cursorY + PRINT_SYSTEM_GAP_UNITS : cursorY
    appendSystemBlock(page, block, nextTargetY)
    cursorY = nextTargetY + block.box.height
    systemCountOnPage += 1
  }

  if (systemCountOnPage > 0 || pages.length === 0) {
    pages.push(page)
  }

  return pages
}

function getPrintSvgPageHeight(width: number) {
  const contentWidthMm = PRINT_PAGE_WIDTH_MM - PRINT_PAGE_MARGIN_MM * 2
  const contentHeightMm = PRINT_PAGE_HEIGHT_MM - PRINT_PAGE_MARGIN_MM * 2

  return width * (contentHeightMm / contentWidthMm)
}

function syncPrintableScorePages(container: HTMLElement, renderTarget: HTMLElement, showTitle: boolean, title: string) {
  const existingPrintStack = container.querySelector('.score-print-stack')
  existingPrintStack?.remove()

  const pages = buildPrintPageSvgs(renderTarget, showTitle, title)
  if (pages.length === 0) {
    return
  }

  const printStack = document.createElement('div')
  printStack.className = 'score-print-stack'
  pages.forEach((page) => {
    printStack.append(createPrintScorePage(page))
  })
  container.append(printStack)
}

function configureDisplayEngraving(
  display: ZoomableDisplay,
  spacingScale: number,
  showMeasureNumbers: boolean,
  measuresPerSystem: number,
) {
  display.EngravingRules.MinimumDistanceBetweenSystems *= spacingScale
  display.EngravingRules.MinSkyBottomDistBetweenSystems *= spacingScale
  display.EngravingRules.RenderMeasureNumbers = showMeasureNumbers
  display.EngravingRules.RenderXMeasuresPerLineAkaSystem = measuresPerSystem
}

function updateVisibleScorePage(container: HTMLElement | null, pageIndex: number) {
  if (!container) {
    return
  }

  const titleBlock = container.querySelector<HTMLElement>('.score-title-block')
  if (titleBlock) {
    titleBlock.hidden = pageIndex !== 0
  }

  const renderTarget = container.querySelector<HTMLElement>('.preview-render-target')
  const pages = renderTarget ? getRenderedPageSvgs(renderTarget) : []
  pages.forEach((page, index) => {
    const isActive = index === pageIndex
    const pageWrapper = page.parentElement && page.parentElement !== renderTarget ? page.parentElement : page
    pageWrapper.classList.add('score-rendered-page')
    pageWrapper.dataset.active = isActive ? 'true' : 'false'
    page.dataset.active = isActive ? 'true' : 'false'
    page.setAttribute('aria-hidden', isActive ? 'false' : 'true')
    page.style.display = ''
    pageWrapper.style.display = ''
  })
}

function revealAllScorePagesForPrint(container: HTMLElement | null) {
  if (!container) {
    return
  }

  const titleBlock = container.querySelector<HTMLElement>('.score-title-block')
  if (titleBlock) {
    titleBlock.hidden = false
  }

  const renderTarget = container.querySelector<HTMLElement>('.preview-render-target')
  const pages = renderTarget ? getRenderedPageSvgs(renderTarget) : []
  pages.forEach((page) => {
    const pageWrapper = page.parentElement && page.parentElement !== renderTarget ? page.parentElement : page
    pageWrapper.classList.add('score-rendered-page')
    pageWrapper.dataset.active = 'true'
    page.dataset.active = 'true'
    page.setAttribute('aria-hidden', 'false')
    page.style.display = ''
    pageWrapper.style.display = ''
  })
}

function getRenderedPageSvgs(renderTarget: HTMLElement) {
  const directPages = Array.from(renderTarget.children).filter(
    (child): child is SVGSVGElement => child instanceof SVGSVGElement,
  )

  if (directPages.length > 0) {
    return directPages
  }

  return Array.from(renderTarget.querySelectorAll<SVGSVGElement>('svg')).filter(
    (svg) => !svg.parentElement?.closest('svg'),
  )
}

function hasRenderedSvgContent(renderTarget: HTMLElement) {
  return getRenderedPageSvgs(renderTarget).some((svg) => svg.childElementCount > 0)
}

function waitForRenderedSvgContent(renderTarget: HTMLElement, shouldCancel: () => boolean) {
  const maxFrames = 30

  return new Promise<boolean>((resolve) => {
    const checkFrame = (frame: number) => {
      if (shouldCancel()) {
        resolve(false)
        return
      }

      if (hasRenderedSvgContent(renderTarget)) {
        resolve(true)
        return
      }

      if (frame >= maxFrames) {
        resolve(false)
        return
      }

      window.requestAnimationFrame(() => checkFrame(frame + 1))
    }

    checkFrame(0)
  })
}

function getAvailableRenderWidth(container: HTMLElement, renderTarget?: HTMLElement) {
  const widthSources = [
    renderTarget,
    renderTarget?.parentElement,
    container.querySelector<HTMLElement>('.score-page__body'),
    container.querySelector<HTMLElement>('.score-page'),
    container,
    container.parentElement,
    container.closest<HTMLElement>('.preview-surface'),
    container.closest<HTMLElement>('.score-preview-card'),
  ]

  for (const source of widthSources) {
    const width = source?.getBoundingClientRect().width ?? 0
    if (width > 0) {
      return Math.max(MIN_ENGRAVING_WIDTH, Math.floor(width))
    }
  }

  return 768
}

function waitForRenderTargetWidth(container: HTMLElement, renderTarget: HTMLElement, shouldCancel: () => boolean) {
  const maxFrames = 30

  return new Promise<number>((resolve) => {
    const checkFrame = (frame: number) => {
      if (shouldCancel()) {
        resolve(0)
        return
      }

      const width = getAvailableRenderWidth(container, renderTarget)
      if (width > 0) {
        resolve(width)
        return
      }

      if (frame >= maxFrames) {
        resolve(768)
        return
      }

      window.requestAnimationFrame(() => checkFrame(frame + 1))
    }

    checkFrame(0)
  })
}

function fitRenderedScoreToPage(container: HTMLElement, renderTarget: HTMLElement, renderTargetWidth: number) {
  const pageBody = container.querySelector<HTMLElement>('.score-page__body')
  const availableWidth = pageBody?.getBoundingClientRect().width ?? renderTargetWidth
  const scale = Math.min(1, availableWidth / renderTargetWidth)
  const renderedPage = getRenderedPageSvgs(renderTarget)[0]
  const renderedHeight = renderedPage?.getBoundingClientRect().height
    ?? renderTarget.scrollHeight
    ?? renderTarget.getBoundingClientRect().height

  renderTarget.style.transform = scale < 1 ? `scale(${scale})` : ''
  renderTarget.style.transformOrigin = 'top left'
  renderTarget.style.height = scale < 1 ? `${renderedHeight}px` : ''
}

function formatSvgNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3)
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
  const dragStartRef = useRef<number | null>(null)
  const renderIdRef = useRef(0)
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

    const renderTarget = container.querySelector<HTMLElement>('.preview-render-target')
    const renderedPages = renderTarget ? getRenderedPageSvgs(renderTarget) : []
    const nextPageCount = Math.max(1, renderedPages.length)
    setPageCount(nextPageCount)
    setPageIndex((current) => {
      const nextPageIndex = resetPage ? 0 : Math.min(current, nextPageCount - 1)
      updateVisibleScorePage(container, nextPageIndex)
      return nextPageIndex
    })
  }, [])

  useEffect(() => {
    updateVisibleScorePage(containerRef.current, pageIndex)
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

        const { page, renderTarget } = createScorePageShell(showTitle, title)
        renderTarget.style.width = '100%'
        renderTarget.style.maxWidth = '100%'
        container.replaceChildren(page)
        const renderTargetWidth = await waitForRenderTargetWidth(
          container,
          renderTarget,
          () => cancelled || renderId !== renderIdRef.current,
        )
        if (cancelled || renderId !== renderIdRef.current) {
          renderTarget.remove()
          return
        }
        renderTarget.style.width = `${renderTargetWidth}px`

        const osmd = new OpenSheetMusicDisplay(renderTarget, {
          autoResize: false,
          drawTitle: false,
          drawPartNames: false,
          drawPartAbbreviations: false,
          backend: 'svg',
          newPageFromXML: true,
          newSystemFromXML: true,
        })

        const spacingScale = deferredPartLayoutPreset.previewSystemSpacing / 100
        configureDisplayEngraving(
          osmd as ZoomableDisplay,
          spacingScale,
          deferredShowMeasureNumbers,
          deferredPartLayoutPreset.measuresPerSystem,
        )

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
        const hasContent = await waitForRenderedSvgContent(
          renderTarget,
          () => cancelled || renderId !== renderIdRef.current,
        )
        if (!hasContent) {
          if (!cancelled && renderId === renderIdRef.current) {
            setPageCount(Math.max(1, getRenderedPageSvgs(renderTarget).length))
            setPageIndex(0)
            setRenderError(null)
          }
          return
        }

        if (cancelled || renderId !== renderIdRef.current) {
          renderTarget.remove()
          return
        }

        const printRenderTarget = document.createElement('div')
        printRenderTarget.className = 'print-render-source'
        printRenderTarget.style.width = `${PRINT_RENDER_WIDTH}px`
        container.append(printRenderTarget)

        try {
          const printOsmd = new OpenSheetMusicDisplay(printRenderTarget, {
            autoResize: false,
            drawTitle: false,
            drawPartNames: false,
            drawPartAbbreviations: false,
            backend: 'svg',
            newPageFromXML: false,
            newSystemFromXML: true,
          })
          configureDisplayEngraving(
            printOsmd as ZoomableDisplay,
            spacingScale,
            deferredShowMeasureNumbers,
            deferredPartLayoutPreset.measuresPerSystem,
          )
          await printOsmd.load(musicXml)
          if (!cancelled && renderId === renderIdRef.current) {
            applyZoom(printOsmd as ZoomableDisplay, BASE_PREVIEW_ZOOM * (deferredPartLayoutPreset.previewNoteScale / 100))
            printOsmd.render()
            await waitForRenderedSvgContent(
              printRenderTarget,
              () => cancelled || renderId !== renderIdRef.current,
            )
          }
          if (!cancelled && renderId === renderIdRef.current) {
            syncPrintableScorePages(container, printRenderTarget, showTitle, title)
          }
        } catch {
          if (!cancelled && renderId === renderIdRef.current) {
            syncPrintableScorePages(container, renderTarget, showTitle, title)
          }
        } finally {
          printRenderTarget.remove()
        }

        fitRenderedScoreToPage(container, renderTarget, renderTargetWidth)
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

  const goToPreviousPage = () => {
    setPageIndex((current) => Math.max(0, current - 1))
  }

  const goToNextPage = () => {
    setPageIndex((current) => Math.min(pageCount - 1, current + 1))
  }

  useEffect(() => {
    const handleBeforePrint = () => {
      revealAllScorePagesForPrint(containerRef.current)
    }

    const handleAfterPrint = () => {
      updateVisibleScorePage(containerRef.current, pageIndex)
    }

    window.addEventListener('beforeprint', handleBeforePrint)
    window.addEventListener('afterprint', handleAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [pageIndex])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isTextEntry = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable)

      if (!musicXml || isTextEntry) {
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToPreviousPage()
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToNextPage()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

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

  const handlePrintScore = () => {
    revealAllScorePagesForPrint(containerRef.current)
    onPrintScore()
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
            onClick={handlePrintScore}
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
        tabIndex={0}
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
