/**
 * React Flow Diagram View - Uses @xyflow/react for interactive diagrams.
 * Post-processed data comes from the backend as ReactFlowDiagramOutput.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  MarkerType,
  ConnectionMode,
  useReactFlow,
} from "@xyflow/react"
import {
  Maximize,
  Download,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Layout,
  Map,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetHeader, SheetBody } from "@/components/ui/sheet"

import { cn } from "@/lib/utils"
import { nodeTypes, edgeTypes } from "@/components/nodes/components"
import { layoutNodes } from "@/lib/layout"
import "@xyflow/react/dist/style.css"

// ============================================================================
// Main Diagram View Component
// ============================================================================

interface ReactFlowDiagramViewProps {
  diagramData?: {
    nodes: any[]
    edges: any[]
    metadata: { layoutDirection: string }
  }
  diagramId?: string
  onDiagramChange?: (nodes: any[], edges: any[]) => void
  fetchDiagramData?: (diagramId: string) => Promise<void>
  className?: string
}

// ============================================================================
// Detail Panel — Shows details for a selected node or edge
// ============================================================================

interface SelectedElement {
  type: "node" | "edge"
  id: string
  elementType: string
  data: any
}

function PropsTab({ d, elementType }: { d: any; elementType: string }) {
  return (
    <div className="space-y-4">
      {/* Identification */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-muted border border-primary rounded-sm flex items-center justify-center">
            <Settings className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-mono text-xs font-bold text-primary uppercase tracking-wider">{elementType}</span>
        </div>
        <div className="space-y-2.5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Name</label>
            <div className="w-full px-3 py-1.5 bg-card border border-border rounded-sm text-sm text-foreground font-mono">
              {d?.label || "—"}
            </div>
          </div>
          {d?.subtitle && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Subtitle</label>
              <div className="w-full px-3 py-1.5 bg-card border border-border rounded-sm text-sm text-foreground font-mono">
                {d.subtitle}
              </div>
            </div>
          )}
          {(d?.purpose || d?.description) && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Description</label>
              <div className="w-full px-3 py-1.5 bg-card border border-border rounded-sm text-sm text-foreground font-mono leading-relaxed min-h-[48px]">
                {d?.purpose || d?.description}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Architecture */}
      {(d?.reasoning || d?.architectureBenefit || d?.designJustification) && (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Architecture</h3>
          <div className="space-y-2.5">
            {d?.architectureBenefit && (
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">Architecture Benefit</label>
                <div className="text-xs text-foreground leading-relaxed">{d.architectureBenefit}</div>
              </div>
            )}
            {d?.designJustification && (
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">Design Justification</label>
                <div className="text-xs text-foreground leading-relaxed">{d.designJustification}</div>
              </div>
            )}
            {d?.reasoning && (
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">Reasoning</label>
                <div className="text-xs text-foreground leading-relaxed">{d.reasoning}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Technologies */}
      {(d?.languageRuntime || d?.frameworkLibrary || d?.databaseEngine || d?.cloudServiceName || d?.cloudTier) && (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Technologies</h3>
          <div className="bg-card border border-border rounded-sm divide-y divide-border text-[11px] font-mono">
            {d?.languageRuntime && d.languageRuntime !== "none" && (
              <div className="flex px-3 py-1.5">
                <span className="w-1/3 text-muted-foreground">Runtime</span>
                <span className="w-2/3 text-foreground">{d.languageRuntime}</span>
              </div>
            )}
            {d?.frameworkLibrary && d.frameworkLibrary !== "none" && (
              <div className="flex px-3 py-1.5">
                <span className="w-1/3 text-muted-foreground">Framework</span>
                <span className="w-2/3 text-foreground">{d.frameworkLibrary}</span>
              </div>
            )}
            {d?.databaseEngine && d.databaseEngine !== "none" && (
              <div className="flex px-3 py-1.5">
                <span className="w-1/3 text-muted-foreground">Database</span>
                <span className="w-2/3 text-foreground">{d.databaseEngine}</span>
              </div>
            )}
            {d?.cloudServiceName && d.cloudServiceName !== "none" && (
              <div className="flex px-3 py-1.5">
                <span className="w-1/3 text-muted-foreground">Cloud Service</span>
                <span className="w-2/3 text-foreground">{d.cloudServiceName}</span>
              </div>
            )}
            {d?.cloudTier && d.cloudTier !== "none" && (
              <div className="flex px-3 py-1.5">
                <span className="w-1/3 text-muted-foreground">Tier</span>
                <span className="w-2/3 text-foreground">{d.cloudTier}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edge Connection Details */}
      {elementType === "edge" && (d?.protocol || d?.flowDirection || d?.logicVariant || d?.dependencyBenefit || d?.couplingJustification) && (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Connection</h3>
          <div className="bg-card border border-border rounded-sm divide-y divide-border text-[11px] font-mono">
            {d?.protocol && d.protocol !== "none" && (
              <div className="flex px-3 py-1.5">
                <span className="w-1/3 text-muted-foreground">Protocol</span>
                <span className="w-2/3 text-foreground">{d.protocol}</span>
              </div>
            )}
            {d?.flowDirection && (
              <div className="flex px-3 py-1.5">
                <span className="w-1/3 text-muted-foreground">Direction</span>
                <span className="w-2/3 text-foreground">{d.flowDirection}</span>
              </div>
            )}
            {d?.logicVariant && (
              <div className="flex px-3 py-1.5">
                <span className="w-1/3 text-muted-foreground">Logic</span>
                <span className="w-2/3 text-foreground">{d.logicVariant}</span>
              </div>
            )}
            {d?.dependencyBenefit && (
              <div className="flex px-3 py-1.5">
                <span className="w-1/3 text-muted-foreground">Dep Benefit</span>
                <span className="w-2/3 text-foreground">{d.dependencyBenefit}</span>
              </div>
            )}
            {d?.couplingJustification && (
              <div className="flex px-3 py-1.5">
                <span className="w-1/3 text-muted-foreground">Coupling</span>
                <span className="w-2/3 text-foreground">{d.couplingJustification}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status / Monitoring Alerts */}
      {d?.statusState && (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Monitoring</h3>
          <div className={cn(
            "border p-2.5 rounded-sm flex items-start gap-2",
            d.statusState === "warning" && "bg-chart-4/10 border-chart-4/30",
            d.statusState === "error" && "bg-destructive/10 border-destructive/30",
            d.statusState === "proposed" && "bg-primary/10 border-primary/20",
            d.statusState === "normal" && "bg-chart-2/10 border-chart-2/30",
          )}>
            <span className={cn(
              "text-xs mt-0.5",
              d.statusState === "warning" && "text-chart-4",
              d.statusState === "error" && "text-destructive",
              d.statusState === "proposed" && "text-primary",
              d.statusState === "normal" && "text-chart-2",
            )}>
              {d.statusState === "warning" ? "⚠" : d.statusState === "error" ? "✕" : d.statusState === "proposed" ? "○" : "●"}
            </span>
            <div>
              <div className="text-[11px] font-bold text-foreground">
                {d.statusState === "normal" ? "Operational" :
                 d.statusState === "warning" ? "Warning Detected" :
                 d.statusState === "error" ? "Critical Error" :
                 d.statusState === "proposed" ? "Proposed Change" : d.statusState}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tags */}
      {d?.metadataTags && d.metadataTags.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Tags</h3>
          <div className="flex flex-wrap gap-1">
            {d.metadataTags.map((tag: string, i: number) => (
              <span key={i} className="bg-card border border-foreground/20 px-1.5 py-0.5 font-mono text-[9px] text-foreground">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SidebarPanel({ element, onClose }: { element: SelectedElement | null; onClose: () => void }) {
  const { type, id, elementType, data: d } = element || { type: "", id: "", elementType: "", data: {} }

  return (
    <Sheet open={!!element} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent onClose={onClose}>
        <SheetHeader className="border-b border-primary/20 shrink-0">
          <div className="flex items-center gap-2 px-4 py-3 min-w-0">
            <span className="bg-muted border border-primary px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary shrink-0">
              {type}
            </span>
            <span className="text-[11px] font-mono text-muted-foreground truncate">{id}</span>
          </div>
        </SheetHeader>

        <SheetBody className="p-4">
          <PropsTab d={d} elementType={elementType} />
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

// ============================================================================
// Direction-aware node enrichment
// Updates BOTH data.layoutDirection (for custom NodeHandle resolution) AND
// the top-level sourcePosition/targetPosition (for React Flow's default edge
// path drawing when no explicit handle ID is matched on an edge).
// ============================================================================

const LAYOUT_SOURCE: Record<string, string> = { LR: "right", RL: "left",  TB: "bottom", BT: "top"    }
const LAYOUT_TARGET: Record<string, string> = { LR: "left",  RL: "right", TB: "top",    BT: "bottom" }

function enrichNodesWithDirection(nodes: any[], direction: string) {
  return nodes.map((n: any) => ({
    ...n,
    sourcePosition: LAYOUT_SOURCE[direction] || "right",
    targetPosition: LAYOUT_TARGET[direction] || "left",
    data: { ...n.data, layoutDirection: direction },
  }))
}

export function ReactFlowCanvas({
  diagramData,
  diagramId,
  onDiagramChange,
  fetchDiagramData,
  className,
}: ReactFlowDiagramViewProps) {
  const [nodes, setNodes] = useState<any[]>(diagramData?.nodes || [])
  const [edges, setEdges] = useState<any[]>(diagramData?.edges || [])
  const [layoutDirection, setLayoutDirection] = useState(diagramData?.metadata?.layoutDirection || "LR")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null)
  const [showMinimap, setShowMinimap] = useState(true)

  const reactFlowInstance = useReactFlow()
  const containerRef = useRef<HTMLDivElement>(null)
  const dataRef = useRef<string>("")

  // Run ELK layout when diagram data content changes
  useEffect(() => {
    if (!diagramData?.nodes) return
    const key = JSON.stringify({ nodes: diagramData.nodes, edges: diagramData.edges })
    if (key === dataRef.current) return
    dataRef.current = key

    const dir = (diagramData.metadata?.layoutDirection as any) || "LR"
    setLayoutDirection(dir)
    setLoading(true)
    layoutNodes(diagramData.nodes, diagramData.edges || [], dir).then((positioned) => {
      // Inject layoutDirection into each node's data + update top-level sourcePosition/targetPosition
      // so edge paths always draw from the correct side when direction changes
      const enriched = enrichNodesWithDirection(positioned, dir)
      setNodes(enriched)
      setEdges(diagramData.edges || [])
      setLoading(false)
      setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2 }), 100)
    })
  }, [diagramData])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds))
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds))
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    const newEdge = {
      ...connection,
      id: `${connection.source}-${connection.target}-${Date.now()}`,
      type: 'default',
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#9ca3af' },
      label: '',
      data: {
        protocol: 'HTTPS',
        flowDirection: 'forward',
        logicVariant: 'standard_flow',
        reasoning: '',
        purpose: '',
        dependencyBenefit: '',
        couplingJustification: '',
      },
    }
    setEdges((eds) => addEdge(newEdge, eds))
    onDiagramChange?.(nodes, [...edges, newEdge])
  }, [edges, nodes, onDiagramChange])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<any>) => {
    setSelectedElement({ type: 'node', id: node.id, elementType: node.type || 'unknown', data: node.data })
  }, [])

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge<any>) => {
    setSelectedElement({ type: 'edge', id: edge.id, elementType: edge.type || 'default', data: edge.data })
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedElement(null)
  }, [])

  const handleDownload = useCallback(() => {
    const data = JSON.stringify({ nodes, edges, metadata: { layoutDirection } }, null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${diagramId || "diagram"}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, edges, layoutDirection, diagramId])

  const fitView = useCallback(() => {
    reactFlowInstance?.fitView({ padding: 0.2 })
  }, [reactFlowInstance])

  const runLayout = useCallback(async (dir?: string) => {
    if (nodes.length === 0) return
    const direction = (dir || layoutDirection) as "TB" | "LR" | "BT" | "RL"
    setLoading(true)
    const positioned = await layoutNodes(nodes, edges, direction)
    setNodes(enrichNodesWithDirection(positioned, direction))
    setLoading(false)
    setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2 }), 100)
  }, [nodes, edges, layoutDirection, reactFlowInstance])

  const toggleMinimap = useCallback(() => setShowMinimap(p => !p), [])

  const fetchDiagram = useCallback(async () => {
    if (!diagramId || !fetchDiagramData) return
    setLoading(true)
    try {
      await fetchDiagramData(diagramId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch diagram")
    } finally {
      setLoading(false)
    }
  }, [diagramId, fetchDiagramData])

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col h-full bg-background", className)}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Select value={layoutDirection} onValueChange={v => { const dir = v as "TB" | "LR" | "BT" | "RL"; setLayoutDirection(dir); runLayout(dir); }}>
                  <SelectTrigger className="w-[130px] h-8">
                    <SelectValue placeholder="Layout" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TB">Top → Bottom</SelectItem>
                    <SelectItem value="LR">Left → Right</SelectItem>
                    <SelectItem value="BT">Bottom → Top</SelectItem>
                    <SelectItem value="RL">Right → Left</SelectItem>
                  </SelectContent>
                </Select>
              </TooltipTrigger>
              <TooltipContent>Layout direction</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-5" />

            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => runLayout()}>
                    <Layout className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Re-layout</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={fitView}>
                    <Maximize className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Fit view</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={toggleMinimap}>
                    <Map className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{showMinimap ? "Hide" : "Show"} minimap</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleDownload}>
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download JSON</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom */}
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md">
              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => reactFlowInstance?.zoomOut()}>
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="px-1.5 text-[11px] text-muted-foreground font-mono min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => reactFlowInstance?.zoomIn()}>
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </div>

            {loading && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">Loading...</span>
              </div>
            )}
            {!diagramData && diagramId && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={fetchDiagram}>
                Fetch
              </Button>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-10">
              <div className="text-center p-4">
                <p className="text-destructive text-sm mb-2">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchDiagram}>Retry</Button>
              </div>
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onViewportChange={({ zoom: z }) => setZoom(z)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView={!diagramData}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            attributionPosition="bottom-right"
          >
            <Background color="hsl(var(--border))" gap={20} size={1} style={{ opacity: 0.4 }} />
            <Controls />
            {showMinimap && <MiniMap />}
          </ReactFlow>
        </div>

        {/* Sidebar — auto-shows when a node/edge is selected */}
        <SidebarPanel element={selectedElement} onClose={() => setSelectedElement(null)} />
      </div>
    </TooltipProvider>
  )
}

// ============================================================================
// Outer wrapper
// ============================================================================

export function ReactFlowDiagramView(props: ReactFlowDiagramViewProps) {
  return (
    <ReactFlowProvider>
      <ReactFlowCanvas {...props} />
    </ReactFlowProvider>
  )
}
