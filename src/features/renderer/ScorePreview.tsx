import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Bug, ChevronLeft, ChevronRight, Copy, Download, Printer, RotateCcw } from 'lucide-react'
import { SectionCard } from '../../components/SectionCard'
import {
  DEFAULT_ADVANCED_PART_LAYOUT_SETTINGS,
  DEFAULT_PART_LAYOUT_PRESET,
  PAGE_FORMATS,
  PART_LAYOUT_PRESETS,
  getPartLayoutPreset,
  type AdvancedPartLayoutSettings,
  type PartLayoutPresetId,
} from '../../music/musicxml/sheetOptions'
import './ScorePreview.css'

type ScorePreviewProps = {
  musicXml: string | null
  title: string
  partLayoutPresetId: PartLayoutPresetId
  advancedLayoutSettings: AdvancedPartLayoutSettings
  onPartLayoutPresetChange: (presetId: PartLayoutPresetId) => void
  onAdvancedLayoutSettingsChange: (settings: AdvancedPartLayoutSettings) => void
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

type SvgDebugMetrics = {
  width: string | null
  height: string | null
  viewBox: string | null
  renderedWidth: number
  renderedHeight: number
  childElementCount: number
  elementCount: number
  textCount: number
  hash: string
}

type PrintDebugPageReport = {
  page: number
  geometryMatches: boolean
  markupMatches: boolean
  preview: SvgDebugMetrics | null
  print: SvgDebugMetrics | null
}

type PrintDebugReport = {
  pageCountMatches: boolean
  mismatchCount: number
  previewPageCount: number
  printPageCount: number
  pages: PrintDebugPageReport[]
}

type PrintVisualDebugApi = () => PrintDebugReport | null

declare global {
  interface Window {
    __staffSmithComparePrintPreview?: PrintVisualDebugApi
    __staffSmithLastPrintDebugReport?: PrintDebugReport | null
  }
}

const BASE_PREVIEW_ZOOM = 0.84
const MIN_ENGRAVING_WIDTH = 720
const UNTITLED_SCORE_TITLE = 'Untitled sketch'
const PAGE_FORMAT_OPTIONS = Object.entries(PAGE_FORMATS).map(([value, definition]) => ({
  value: value as AdvancedPartLayoutSettings['pageFormat'],
  label: definition.label,
}))

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

function createPrintScorePage(svg: SVGSVGElement, showTitle: boolean, title: string) {
  const page = document.createElement('article')
  page.className = showTitle ? 'score-print-page score-print-page--with-title' : 'score-print-page'
  page.setAttribute('aria-hidden', 'true')

  if (showTitle) {
    page.append(createScoreTitleBlock(title))
  }

  const body = document.createElement('div')
  body.className = 'score-print-page__body'
  body.append(svg.cloneNode(true))
  page.append(body)

  return page
}

function syncPrintableScorePages(container: HTMLElement, renderTarget: HTMLElement, showTitle: boolean, title: string) {
  const existingPrintStack = container.querySelector('.score-print-stack')
  existingPrintStack?.remove()

  const pages = getRenderedPageSvgs(renderTarget)
  if (pages.length === 0) {
    return
  }

  const printStack = document.createElement('div')
  printStack.className = 'score-print-stack score-engraving'
  pages.forEach((page, index) => {
    printStack.append(createPrintScorePage(page, showTitle && index === 0, title))
  })
  container.append(printStack)
}

function getPrintPageSvgs(container: HTMLElement) {
  return Array.from(container.querySelectorAll<SVGSVGElement>('.score-print-page__body > svg'))
}

function hashString(value: string) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

function getSvgDebugMetrics(svg: SVGSVGElement): SvgDebugMetrics {
  const bounds = svg.getBoundingClientRect()
  const width = svg.getAttribute('width')
  const height = svg.getAttribute('height')
  const fallbackWidth = Number.parseFloat(width ?? '')
  const fallbackHeight = Number.parseFloat(height ?? '')

  return {
    width,
    height,
    viewBox: svg.getAttribute('viewBox'),
    renderedWidth: Math.round((bounds.width || fallbackWidth || 0) * 100) / 100,
    renderedHeight: Math.round((bounds.height || fallbackHeight || 0) * 100) / 100,
    childElementCount: svg.childElementCount,
    elementCount: svg.querySelectorAll('*').length,
    textCount: svg.querySelectorAll('text').length,
    hash: hashString(svg.outerHTML),
  }
}

function svgGeometryMatches(preview: SvgDebugMetrics | null, print: SvgDebugMetrics | null) {
  return Boolean(
    preview
    && print
    && preview.width === print.width
    && preview.height === print.height
    && preview.viewBox === print.viewBox,
  )
}

function svgMarkupMatches(preview: SvgDebugMetrics | null, print: SvgDebugMetrics | null) {
  return Boolean(preview && print && preview.hash === print.hash)
}

function getSvgAspectRatio(svg: SVGSVGElement) {
  const width = Number.parseFloat(svg.getAttribute('width') ?? '')
  const height = Number.parseFloat(svg.getAttribute('height') ?? '')

  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return `${width} / ${height}`
  }

  const viewBox = svg.viewBox.baseVal
  if (viewBox.width > 0 && viewBox.height > 0) {
    return `${viewBox.width} / ${viewBox.height}`
  }

  return '210 / 297'
}

function createPrintDebugReport(previewPages: SVGSVGElement[], printPages: SVGSVGElement[]): PrintDebugReport {
  const pageCount = Math.max(previewPages.length, printPages.length)
  const pages = Array.from({ length: pageCount }, (_, index): PrintDebugPageReport => {
    const preview = previewPages[index] ? getSvgDebugMetrics(previewPages[index]) : null
    const print = printPages[index] ? getSvgDebugMetrics(printPages[index]) : null

    return {
      page: index + 1,
      geometryMatches: svgGeometryMatches(preview, print),
      markupMatches: svgMarkupMatches(preview, print),
      preview,
      print,
    }
  })

  return {
    pageCountMatches: previewPages.length === printPages.length,
    mismatchCount: pages.filter((page) => !page.geometryMatches || !page.markupMatches).length,
    previewPageCount: previewPages.length,
    printPageCount: printPages.length,
    pages,
  }
}

function createDebugLabel(text: string, className?: string) {
  const label = document.createElement('span')
  label.className = className ? `score-print-debug-label ${className}` : 'score-print-debug-label'
  label.textContent = text
  return label
}

function createDebugSvgPanel(label: string, svg: SVGSVGElement | undefined) {
  const panel = document.createElement('div')
  panel.className = 'score-print-debug-panel'
  panel.append(createDebugLabel(label))

  const visual = document.createElement('div')
  visual.className = 'score-print-debug-page-visual'

  if (svg) {
    visual.style.setProperty('--score-print-debug-ratio', getSvgAspectRatio(svg))
    visual.append(svg.cloneNode(true))
  } else {
    visual.classList.add('score-print-debug-page-visual--empty')
    visual.textContent = 'Missing page'
  }

  panel.append(visual)
  return panel
}

function createDebugOverlayPanel(previewSvg: SVGSVGElement | undefined, printSvg: SVGSVGElement | undefined) {
  const panel = document.createElement('div')
  panel.className = 'score-print-debug-panel'
  panel.append(createDebugLabel('Overlap'))

  const visual = document.createElement('div')
  visual.className = 'score-print-debug-page-visual score-print-debug-page-visual--overlay'
  const sourceSvg = previewSvg ?? printSvg
  if (sourceSvg) {
    visual.style.setProperty('--score-print-debug-ratio', getSvgAspectRatio(sourceSvg))
  }

  if (previewSvg) {
    const previewClone = previewSvg.cloneNode(true) as SVGSVGElement
    previewClone.classList.add('score-print-debug-overlay-svg', 'score-print-debug-overlay-svg--preview')
    visual.append(previewClone)
  }

  if (printSvg) {
    const printClone = printSvg.cloneNode(true) as SVGSVGElement
    printClone.classList.add('score-print-debug-overlay-svg', 'score-print-debug-overlay-svg--print')
    visual.append(printClone)
  }

  panel.append(visual)
  return panel
}

function renderPrintDebugOverlay(report: PrintDebugReport, previewPages: SVGSVGElement[], printPages: SVGSVGElement[]) {
  document.querySelector('.score-print-debug-overlay')?.remove()

  const overlay = document.createElement('aside')
  overlay.className = 'score-print-debug-overlay'
  overlay.setAttribute('aria-label', 'Score print visual debug')

  const header = document.createElement('header')
  header.className = 'score-print-debug-header'

  const heading = document.createElement('h2')
  heading.textContent = 'Score vs Print'

  const summary = document.createElement('p')
  summary.textContent = `${report.previewPageCount} score pages, ${report.printPageCount} print pages, ${report.mismatchCount} mismatches`

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.textContent = 'Close'
  closeButton.addEventListener('click', () => overlay.remove())

  header.append(heading, summary, closeButton)
  overlay.append(header)

  const scroll = document.createElement('div')
  scroll.className = 'score-print-debug-scroll'

  report.pages.forEach((pageReport, index) => {
    const section = document.createElement('section')
    section.className = pageReport.geometryMatches && pageReport.markupMatches
      ? 'score-print-debug-page score-print-debug-page--match'
      : 'score-print-debug-page score-print-debug-page--mismatch'

    const pageHeading = document.createElement('h3')
    pageHeading.textContent = `Page ${pageReport.page}`

    const details = document.createElement('p')
    details.textContent = `Geometry ${pageReport.geometryMatches ? 'matches' : 'differs'} · SVG ${pageReport.markupMatches ? 'matches' : 'differs'}`

    const grid = document.createElement('div')
    grid.className = 'score-print-debug-grid'
    grid.append(
      createDebugSvgPanel('Score', previewPages[index]),
      createDebugSvgPanel('Print', printPages[index]),
      createDebugOverlayPanel(previewPages[index], printPages[index]),
    )

    section.append(pageHeading, details, grid)
    scroll.append(section)
  })

  overlay.append(scroll)
  document.body.append(overlay)
}

function comparePrintPreviewVisually(
  container: HTMLElement,
  showTitle: boolean,
  title: string,
): PrintDebugReport | null {
  const renderTarget = container.querySelector<HTMLElement>('.preview-render-target')
  if (!renderTarget) {
    return null
  }

  syncPrintableScorePages(container, renderTarget, showTitle, title)

  const previewPages = getRenderedPageSvgs(renderTarget)
  const printPages = getPrintPageSvgs(container)
  const report = createPrintDebugReport(previewPages, printPages)

  window.__staffSmithLastPrintDebugReport = report
  renderPrintDebugOverlay(report, previewPages, printPages)

  return report
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

function applyPageFormatCssVariables(container: HTMLElement, settings: AdvancedPartLayoutSettings) {
  const pageFormat = PAGE_FORMATS[settings.pageFormat]

  container.style.setProperty('--score-page-width-mm', String(pageFormat.widthMm))
  container.style.setProperty('--score-page-height-mm', String(pageFormat.heightMm))
}

function clampAdvancedSetting(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.max(min, Math.min(max, value))
}

function readIntegerSetting(value: string, min: number, max: number) {
  return Math.round(clampAdvancedSetting(Number(value), min, max))
}

function readDecimalSetting(value: string, min: number, max: number) {
  return Math.round(clampAdvancedSetting(Number(value), min, max) * 10) / 10
}

export function ScorePreview({
  musicXml,
  title,
  partLayoutPresetId,
  advancedLayoutSettings,
  onPartLayoutPresetChange,
  onAdvancedLayoutSettingsChange,
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
  const activePreviewLayout = useMemo(() => (
    partLayoutPresetId === 'advanced'
      ? {
        ...partLayoutPreset,
        measuresPerSystem: advancedLayoutSettings.measuresPerSystem,
        previewNoteScale: advancedLayoutSettings.previewNoteScale,
        previewSystemSpacing: advancedLayoutSettings.previewSystemSpacing,
      }
      : partLayoutPreset
  ), [advancedLayoutSettings, partLayoutPreset, partLayoutPresetId])
  const deferredPartLayoutPreset = useDeferredValue(activePreviewLayout)
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
    if (!import.meta.env.DEV) {
      return undefined
    }

    const comparePrintPreview: PrintVisualDebugApi = () => {
      const container = containerRef.current
      return container ? comparePrintPreviewVisually(container, showTitle, title) : null
    }

    window.__staffSmithComparePrintPreview = comparePrintPreview
    return () => {
      if (window.__staffSmithComparePrintPreview === comparePrintPreview) {
        delete window.__staffSmithComparePrintPreview
      }
    }
  }, [showTitle, title])

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
    applyPageFormatCssVariables(
      container,
      partLayoutPresetId === 'advanced' ? advancedLayoutSettings : DEFAULT_ADVANCED_PART_LAYOUT_SETTINGS,
    )

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

        fitRenderedScoreToPage(container, renderTarget, renderTargetWidth)
        syncPrintableScorePages(container, renderTarget, showTitle, title)
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
  }, [
    advancedLayoutSettings,
    deferredPartLayoutPreset,
    deferredShowMeasureNumbers,
    musicXml,
    partLayoutPresetId,
    showTitle,
    title,
    updateRenderedPages,
  ])

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
    onAdvancedLayoutSettingsChange(DEFAULT_ADVANCED_PART_LAYOUT_SETTINGS)
    setShowTitle(true)
    setShowMeasureNumbers(true)
  }

  const updateAdvancedLayoutSetting = <Key extends keyof AdvancedPartLayoutSettings>(
    key: Key,
    value: AdvancedPartLayoutSettings[Key],
  ) => {
    onAdvancedLayoutSettingsChange({
      ...advancedLayoutSettings,
      [key]: value,
    })
  }

  const handleComparePrintPreview = () => {
    const container = containerRef.current
    if (!container) {
      return
    }

    comparePrintPreviewVisually(container, showTitle, title)
  }

  const handlePrintScore = () => {
    const container = containerRef.current
    const renderTarget = container?.querySelector<HTMLElement>('.preview-render-target')

    if (container && renderTarget) {
      syncPrintableScorePages(container, renderTarget, showTitle, title)
    }

    revealAllScorePagesForPrint(container)
    onPrintScore()
  }

  const showAdvancedControls = partLayoutPresetId === 'advanced'

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
      {showAdvancedControls ? (
        <div className="advanced-layout-panel" aria-label="Advanced layout settings">
          <div className="advanced-layout-panel__group advanced-layout-panel__group--paper">
            <span className="advanced-layout-label">Paper</span>
            <div className="advanced-layout-segmented" role="group" aria-label="Paper layout">
              {PAGE_FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={advancedLayoutSettings.pageFormat === option.value ? 'is-active' : undefined}
                  onClick={() => updateAdvancedLayoutSetting('pageFormat', option.value)}
                  aria-pressed={advancedLayoutSettings.pageFormat === option.value}
                  disabled={!musicXml}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className="advanced-layout-field">
            <span>Measures/line</span>
            <input
              type="number"
              min="1"
              max="12"
              step="1"
              value={advancedLayoutSettings.measuresPerSystem}
              onChange={(event) => updateAdvancedLayoutSetting('measuresPerSystem', readIntegerSetting(event.target.value, 1, 12))}
              disabled={!musicXml}
            />
          </label>

          <label className="advanced-layout-field">
            <span>Lines/page</span>
            <input
              type="number"
              min="1"
              max="13"
              step="1"
              value={advancedLayoutSettings.systemsPerPageTarget}
              onChange={(event) => updateAdvancedLayoutSetting('systemsPerPageTarget', readIntegerSetting(event.target.value, 1, 13))}
              disabled={!musicXml}
            />
          </label>

          <label className="advanced-layout-field">
            <span>Engraving</span>
            <input
              type="number"
              min="50"
              max="140"
              step="1"
              value={advancedLayoutSettings.previewNoteScale}
              onChange={(event) => updateAdvancedLayoutSetting('previewNoteScale', readIntegerSetting(event.target.value, 50, 140))}
              disabled={!musicXml}
            />
          </label>

          <label className="advanced-layout-field">
            <span>Line height</span>
            <input
              type="number"
              min="60"
              max="150"
              step="1"
              value={advancedLayoutSettings.previewSystemSpacing}
              onChange={(event) => updateAdvancedLayoutSetting('previewSystemSpacing', readIntegerSetting(event.target.value, 60, 150))}
              disabled={!musicXml}
            />
          </label>

          <label className="advanced-layout-field">
            <span>System gap</span>
            <input
              type="number"
              min="1"
              max="18"
              step="0.5"
              value={advancedLayoutSettings.minimumSystemGapMm}
              onChange={(event) => updateAdvancedLayoutSetting('minimumSystemGapMm', readDecimalSetting(event.target.value, 1, 18))}
              disabled={!musicXml}
            />
          </label>

          <label className="advanced-layout-field">
            <span>Top</span>
            <input
              type="number"
              min="4"
              max="36"
              step="0.5"
              value={advancedLayoutSettings.topMarginMm}
              onChange={(event) => updateAdvancedLayoutSetting('topMarginMm', readDecimalSetting(event.target.value, 4, 36))}
              disabled={!musicXml}
            />
          </label>

          <label className="advanced-layout-field">
            <span>Bottom</span>
            <input
              type="number"
              min="4"
              max="36"
              step="0.5"
              value={advancedLayoutSettings.bottomMarginMm}
              onChange={(event) => updateAdvancedLayoutSetting('bottomMarginMm', readDecimalSetting(event.target.value, 4, 36))}
              disabled={!musicXml}
            />
          </label>

          <label className="advanced-layout-field">
            <span>Inside</span>
            <input
              type="number"
              min="4"
              max="30"
              step="0.5"
              value={advancedLayoutSettings.insideMarginMm}
              onChange={(event) => updateAdvancedLayoutSetting('insideMarginMm', readDecimalSetting(event.target.value, 4, 30))}
              disabled={!musicXml}
            />
          </label>

          <label className="advanced-layout-field">
            <span>Outside</span>
            <input
              type="number"
              min="4"
              max="30"
              step="0.5"
              value={advancedLayoutSettings.outsideMarginMm}
              onChange={(event) => updateAdvancedLayoutSetting('outsideMarginMm', readDecimalSetting(event.target.value, 4, 30))}
              disabled={!musicXml}
            />
          </label>

          <div className="advanced-layout-actions">
            <button
              type="button"
              className="advanced-layout-button"
              onClick={() => onAdvancedLayoutSettingsChange(DEFAULT_ADVANCED_PART_LAYOUT_SETTINGS)}
              disabled={!musicXml}
            >
              Reset Advanced
            </button>
            {import.meta.env.DEV ? (
              <button
                type="button"
                className="advanced-layout-button advanced-layout-button--debug"
                onClick={handleComparePrintPreview}
                disabled={!musicXml}
              >
                <Bug size={14} aria-hidden="true" />
                Compare
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
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
