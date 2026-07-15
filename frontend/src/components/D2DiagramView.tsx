import { useCallback, useEffect, useRef, useState } from "react"
import { D2 } from "@terrastruct/d2"
import { Minimize, Maximize, Download, Copy, RefreshCw, Code } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

type RenderMode = "wasm" | "cli" | "sse"

type ThemeId = 0 | 1 | 2 | 100 | 200 | 300

interface D2DiagramViewProps {
  d2Source: string
  diagramId?: string
  onD2SourceChange?: (source: string) => void
  className?: string
}

export function D2DiagramView({
  d2Source,
  diagramId,
  onD2SourceChange,
  className,
}: D2DiagramViewProps) {
  const [svg, setSvg] = useState<string>("")
  const [renderMode, setRenderMode] = useState<RenderMode>("wasm")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemeId>(0)
  const [layoutEngine, setLayoutEngine] = useState<"dagre" | "elk" | "tala">("dagre")
  const [zoom, setZoom] = useState(1)
  const [showSource, setShowSource] = useState(true)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  const svgRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    setZoom(prev => {
      const next = Math.min(Math.max(prev - e.deltaY * 0.001, 0.1), 5)
      return next
    })
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return
    const target = e.target as HTMLElement
    if (target === containerRef.current || svgRef.current?.contains(e.target as Node)) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
  }, [isPanning, panStart])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  const renderDiagram = useCallback(async () => {
    if (!d2Source.trim()) {
      setSvg("")
      return
    }
    setLoading(true)
    setError(null)

    try {
      let result: string = ""

      if (renderMode === "wasm") {
        // Browser WASM rendering
        const d2 = new D2()
        // tala is only supported on backend; use dagre for WASM
        const wasmLayout = layoutEngine === "tala" ? "dagre" : layoutEngine
        const compileResponse = await d2.compile(d2Source, {
          options: {
            layout: wasmLayout,
            themeID: theme,
            sketch: false,
          },
        })
        const svgResult = await d2.render(compileResponse.diagram, {
          ...compileResponse.renderOptions,
          themeID: theme,
          sketch: false,
        })
        result = svgResult
      } else if (renderMode === "cli") {
        // Server CLI rendering
        const res = await fetch("/api/chat/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            d2_source: d2Source,
            format: "svg",
            theme_id: theme,
            dark_theme_id: theme,
            layout_engine: layoutEngine,
            pad: 100,
            sketch: false,
          }),
        })
        if (!res.ok) throw new Error("Render failed")
        result = await res.text()
      } else if (renderMode === "sse") {
        // SSE streaming - fallback to CLI for now
        const res = await fetch("/api/chat/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            d2_source: d2Source,
            format: "svg",
            theme_id: theme,
            dark_theme_id: theme,
            layout_engine: layoutEngine,
            pad: 100,
            sketch: false,
          }),
        })
        if (!res.ok) throw new Error("Render failed")
        result = await res.text()
      }

      setSvg(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render diagram")
    } finally {
      setLoading(false)
    }
  }, [d2Source, renderMode, theme, layoutEngine])

  useEffect(() => {
    renderDiagram()
  }, [renderDiagram])

  const handleDownloadSvg = () => {
    if (!svg) return
    const blob = new Blob([svg], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${diagramId || "diagram"}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPng = async () => {
    if (!svgRef.current) return
    // Fallback: render to canvas
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width * 2
      canvas.height = img.height * 2
      ctx.scale(2, 2)
      ctx.drawImage(img, 0, 0)
      const url = canvas.toDataURL("image/png")
      const a = document.createElement("a")
      a.href = url
      a.download = `${diagramId || "diagram"}.png`
      a.click()
    }
    img.src = "data:image/svg+xml;base64," + btoa(svg)
  }

  const handleCopySource = () => {
    navigator.clipboard.writeText(d2Source)
  }

  const handleResetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const getThemeName = (id: ThemeId) => {
    const themes: Record<ThemeId, string> = {
      0: "Default",
      1: "Mixed Berry Blue",
      2: "Vanilla Nitro Cola",
      100: "Terminal",
      200: "Flagship",
      300: "Earth",
    }
    return themes[id] || `Theme ${id}`
  }

  const layoutNames: Record<string, string> = {
    dagre: "Dagre (Hierarchical)",
    elk: "ELK (Orthogonal)",
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex-1 flex flex-col bg-background relative",
          className
        )}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            {/* Render Mode Selector */}
            <Tooltip>
              <TooltipTrigger asChild>
                <RadioGroup
                  value={renderMode}
                  onValueChange={v => setRenderMode(v as RenderMode)}
                  className="flex items-center gap-2"
                >
                  <RadioGroupItem value="wasm" className="hidden sm:flex" />
                  <RadioGroupItem value="cli" className="hidden sm:flex" />
                  <RadioGroupItem value="sse" className="hidden sm:flex" />
                </RadioGroup>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="space-y-1 p-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="wasm" />
                    <span className="text-sm">WASM</span>
                    <span className="text-xs text-muted-foreground">Browser (instant)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="cli" />
                    <span className="text-sm">CLI</span>
                    <span className="text-xs text-muted-foreground">Server (full fidelity)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="sse" />
                    <span className="text-sm">SSE</span>
                    <span className="text-xs text-muted-foreground">Streaming</span>
                  </label>
                </div>
              </TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6 mx-2" />

            {/* Theme Selector */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Select value={theme.toString()} onValueChange={e => setTheme(Number(e) as ThemeId)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Theme" />
                  </SelectTrigger>
                  <SelectContent>
                    {([0, 1, 2, 100, 200, 300] as const).map(t => (
                      <SelectItem key={t} value={t.toString()}>
                        {getThemeName(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TooltipTrigger>
              <TooltipContent>Diagram color theme</TooltipContent>
            </Tooltip>

            {/* Layout Engine Selector */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Select value={layoutEngine} onValueChange={v => setLayoutEngine(v as "dagre" | "elk" | "tala")}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Layout" />
                  </SelectTrigger>
                  <SelectContent>
                    {(["dagre", "elk", "tala"] as const).map(l => (
                      <SelectItem key={l} value={l}>
                        {layoutNames[l]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TooltipTrigger>
              <TooltipContent>Layout engine</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={handleResetView}
                title="Reset view"
              >
                <Maximize className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom(z => Math.max(z - 0.1, 0.1))}
                title="Zoom out"
              >
                <Minimize className="w-4 h-4" />
              </Button>
              <span className="px-2 text-xs text-muted-foreground font-mono">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom(z => Math.min(z + 0.1, 5))}
                title="Zoom in"
              >
                <Maximize className="w-4 h-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6 mx-2" />

            {/* Actions */}
            <Button variant="outline" size="icon" onClick={handleCopySource} title="Copy D2 source">
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleDownloadSvg} title="Download SVG">
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleDownloadPng} title="Download PNG">
              <Download className="w-4 h-4" />
            </Button>
            <Button
                variant="outline"
                size="icon"
                onClick={() => setShowSource(!showSource)}
                title={showSource ? "Hide D2 source" : "Show D2 source"}
              >
                <Code className="w-4 h-4" />
              </Button>
          </div>
        </div>

        {/* Canvas Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ touchAction: "none" }}
        >
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-10">
              <div className="text-center p-4">
                <p className="text-destructive mb-2">{error}</p>
                <Button variant="outline" size="sm" onClick={renderDiagram}>
                  Retry
                </Button>
              </div>
            </div>
          )}

          {loading && !svg && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-10">
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Rendering with {renderMode.toUpperCase()}...
                </span>
              </div>
            </div>
          )}

          {!loading && svg && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
                transition: "transform 0.1s ease-out",
              }}
            >
              <div
                ref={svgRef}
                className="max-w-full max-h-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
          )}

          {!svg && !loading && !error && !d2Source && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <p className="text-center">No diagram source</p>
            </div>
          )}
        </div>

        {/* D2 Source Panel (collapsible) */}
        {showSource && (
          <div className="border-t border-border bg-background/50 shrink-0">
            <div className="flex items-center justify-between p-2 bg-muted/50">
              <span className="text-xs font-mono text-muted-foreground">D2 Source</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={handleCopySource} title="Copy source">
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setShowSource(false)} title="Hide D2 source">
                  <Code className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <textarea
              value={d2Source}
              onChange={e => onD2SourceChange?.(e.target.value)}
              className="w-full h-48 p-3 font-mono text-xs bg-background border-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
              spellCheck={false}
              placeholder="// Edit D2 source directly..."
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}