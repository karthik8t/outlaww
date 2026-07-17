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
  PanelRight,
  Map,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
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

// Detail field renderer for sidebar
function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value || value === "none") return null
  return (
    <div className="space-y-0.5">
      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">{label}</dt>
      <dd className="text-xs text-foreground/80 leading-relaxed">{value}</dd>
    </div>
  )
}

function SidebarPanel({
  element,
  onClose,
}: {
  element: { type: "node" | "edge"; data: any } | null
  onClose: () => void
}) {
  if (!element) return null
  const { type, data: d } = element

  return (
    <div className="fixed right-0 top-16 bottom-0 w-80 bg-background border-l border-border shadow-xl z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize text-[10px]">{type}</Badge>
          <span className="text-xs font-mono text-muted-foreground truncate max-w-[180px]">{d?.id || d?.label}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {type === "node" && (
          <>
            <Section title="Node">
              <DetailRow label="Label" value={d?.label} />
              <DetailRow label="Subtitle" value={d?.subtitle} />
              <DetailRow label="Type" value={d?.borderStyle} />
            </Section>

            {(d?.reasoning || d?.purpose) && (
              <Section title="Architecture">
                <DetailRow label="Reasoning" value={d?.reasoning} />
                <DetailRow label="Purpose" value={d?.purpose} />
                <DetailRow label="Benefit" value={d?.architectureBenefit} />
                <DetailRow label="Design Justification" value={d?.designJustification} />
              </Section>
            )}

            {(d?.languageRuntime || d?.frameworkLibrary || d?.databaseEngine || d?.cloudServiceName) && (
              <Section title="Tech Stack">
                <DetailRow label="Runtime" value={d?.languageRuntime} />
                <DetailRow label="Framework" value={d?.frameworkLibrary} />
                <DetailRow label="Database" value={d?.databaseEngine} />
                <DetailRow label="Cloud Service" value={d?.cloudServiceName} />
                <DetailRow label="Tier" value={d?.cloudTier} />
              </Section>
            )}
          </>
        )}

        {type === "edge" && (
          <>
            {(d?.reasoning || d?.purpose) && (
              <Section title="Architecture">
                <DetailRow label="Reasoning" value={d?.reasoning} />
                <DetailRow label="Purpose" value={d?.purpose} />
                <DetailRow label="Benefit" value={d?.dependencyBenefit} />
                <DetailRow label="Coupling" value={d?.couplingJustification} />
              </Section>
            )}

            <Section title="Connection">
              <DetailRow label="Protocol" value={d?.protocol} />
              <DetailRow label="Flow Direction" value={d?.flowDirection} />
              <DetailRow label="Logic" value={d?.logicVariant} />
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/80 mb-2">{title}</h4>
      <dl className="space-y-2">
        {children}
      </dl>
    </div>
  )
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
  const [showSidebar, setShowSidebar] = useState(true)
  const [selectedElement, setSelectedElement] = useState<{ type: 'node' | 'edge'; data: any } | null>(null)
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
      setNodes(positioned)
      setEdges(diagramData.edges || [])
      setLoading(false)
      setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2 }), 100)
    })
  }, [diagramData])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => {
      const newNodes = changes.reduce((acc, change) => {
        if (change.type === 'position') {
          return acc.map((node) => node.id === change.id ? { ...node, position: change.position! } : node)
        }
        if (change.type === 'remove') {
          return acc.filter((node) => node.id !== change.id)
        }
        return acc
      }, nds)
      return newNodes
    })
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => {
      const newEdges = changes.reduce((acc, change) => {
        if (change.type === 'remove') {
          return acc.filter((edge) => edge.id !== change.id)
        }
        return acc
      }, eds)
      return newEdges
    })
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
    setSelectedElement({ type: 'node', data: node.data })
  }, [])

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge<any>) => {
    setSelectedElement({ type: 'edge', data: edge.data })
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

  const runLayout = useCallback(async () => {
    if (nodes.length === 0) return
    setLoading(true)
    const positioned = await layoutNodes(nodes, edges, layoutDirection)
    setNodes(positioned)
    setLoading(false)
    setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2 }), 100)
  }, [nodes, edges, layoutDirection, reactFlowInstance])

  const toggleMinimap = useCallback(() => setShowMinimap(p => !p), [])
  const toggleSidebar = useCallback(() => setShowSidebar(p => !p), [])

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

  const initialNodes = nodes.length > 0 ? nodes : undefined
  const initialEdges = edges.length > 0 ? edges : undefined

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col h-full bg-background", className)}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Select value={layoutDirection} onValueChange={v => setLayoutDirection(v as "TB" | "LR" | "BT" | "RL")}>
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
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={runLayout}>
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
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={toggleSidebar}>
                    <PanelRight className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{showSidebar ? "Hide" : "Show"} sidebar</TooltipContent>
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
        <div ref={containerRef} className="flex-1 relative overflow-hidden" onClick={onPaneClick}>
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-10">
              <div className="text-center p-4">
                <p className="text-destructive text-sm mb-2">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchDiagram}>Retry</Button>
              </div>
            </div>
          )}

          <ReactFlow
            nodes={initialNodes}
            edges={initialEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
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

        {/* Sidebar */}
        {showSidebar && <SidebarPanel element={selectedElement} onClose={() => setSelectedElement(null)} />}
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
