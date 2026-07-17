/**
 * React Flow Diagram View - Uses @xyflow/react for interactive diagrams.
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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

  // Sync props to state — run ELK layout on new data
  useEffect(() => {
    if (diagramData?.nodes) {
      const dir = (diagramData.metadata?.layoutDirection as any) || "LR"
      setLayoutDirection(dir)
      setLoading(true)
      layoutNodes(diagramData.nodes, diagramData.edges || [], dir).then((positioned) => {
        setNodes(positioned)
        setEdges(diagramData.edges || [])
        setLoading(false)
        setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2 }), 100)
      })
    }
  }, [diagramData])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => {
      const newNodes = changes.reduce((acc, change) => {
        if (change.type === 'position') {
          return acc.map((node) => node.id === change.id ? { ...node, position: change.position } : node)
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
      markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
      label: (connection as any).label || '',
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
        <div className="flex items-center justify-between p-3 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            {/* Layout Direction */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Select value={layoutDirection} onValueChange={v => setLayoutDirection(v as "TB" | "LR" | "BT" | "RL")}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Layout" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TB">Top \u2192 Bottom (Flow)</SelectItem>
                    <SelectItem value="LR">Left \u2192 Right (Cloud/C4)</SelectItem>
                    <SelectItem value="BT">Bottom \u2192 Top</SelectItem>
                    <SelectItem value="RL">Right \u2192 Left</SelectItem>
                  </SelectContent>
                </Select>
              </TooltipTrigger>
              <TooltipContent>Layout direction</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6 mx-2" />

            {/* Actions */}
            <Button variant="outline" size="icon" onClick={runLayout} title="Re-layout with ELK">
              <Layout className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={fitView} title="Fit view">
              <Maximize className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={toggleMinimap} title={showMinimap ? "Hide minimap" : "Show minimap"}>
              <Map className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={toggleSidebar} title={showSidebar ? "Hide sidebar" : "Show sidebar"}>
              <PanelRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleDownload} title="Download JSON">
              <Download className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => reactFlowInstance?.zoomOut()} title="Zoom out">
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="px-2 text-xs text-muted-foreground font-mono">{Math.round(zoom * 100)}%</span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => reactFlowInstance?.zoomIn()} title="Zoom in">
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6 mx-2" />

            {loading && (
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            )}
            {!diagramData && diagramId && (
              <Button variant="outline" size="sm" onClick={fetchDiagram}>
                Fetch from server
              </Button>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
          onClick={onPaneClick}
        >
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-10">
              <div className="text-center p-4">
                <p className="text-destructive mb-2">{error}</p>
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
            <Background
              color="#e5e7eb"
              gap={20}
              size={1}
              style={{ opacity: 0.5 }}
            />
            <Controls />
            {showMinimap && <MiniMap />}
          </ReactFlow>
        </div>

        {/* Sidebar */}
        {showSidebar && selectedElement && (
          <div className="fixed right-0 top-16 bottom-0 w-80 bg-background border-l border-border shadow-xl z-40 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold capitalize">{selectedElement.type}</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedElement(null)}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </Button>
            </div>
            <div className="space-y-3 text-sm">
              {selectedElement.type === 'node' && (
                <>
                  <div className="font-mono text-xs text-gray-500">{selectedElement.data.id}</div>
                  {selectedElement.data.reasoning && <p className="text-gray-700 dark:text-gray-300"><strong>Reasoning:</strong> {selectedElement.data.reasoning}</p>}
                  {selectedElement.data.purpose && <p className="text-gray-700 dark:text-gray-300"><strong>Purpose:</strong> {selectedElement.data.purpose}</p>}
                  {selectedElement.data.architectureBenefit && <p className="text-gray-700 dark:text-gray-300"><strong>Benefit:</strong> {selectedElement.data.architectureBenefit}</p>}
                  {selectedElement.data.designJustification && <p className="text-gray-700 dark:text-gray-300"><strong>Design:</strong> {selectedElement.data.designJustification}</p>}
                </>
              )}
              {selectedElement.type === 'edge' && (
                <>
                  <div className="font-mono text-xs text-gray-500">{selectedElement.data.id}</div>
                  {selectedElement.data.reasoning && <p className="text-gray-700 dark:text-gray-300"><strong>Reasoning:</strong> {selectedElement.data.reasoning}</p>}
                  {selectedElement.data.purpose && <p className="text-gray-700 dark:text-gray-300"><strong>Purpose:</strong> {selectedElement.data.purpose}</p>}
                  {selectedElement.data.protocol !== 'none' && <p className="text-gray-700 dark:text-gray-300"><strong>Protocol:</strong> {selectedElement.data.protocol}</p>}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}


// ============================================================================
// Outer wrapper providing ReactFlowProvider context
// ============================================================================

export function ReactFlowDiagramView(props: ReactFlowDiagramViewProps) {
  return (
    <ReactFlowProvider>
      <ReactFlowCanvas {...props} />
    </ReactFlowProvider>
  )
}