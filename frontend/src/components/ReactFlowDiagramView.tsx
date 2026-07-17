/**
 * React Flow Diagram View - Uses @xyflow/react for interactive diagrams.
 * Replaces the D2-based renderer with a native React Flow component.
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
  type EdgeProps,
} from "@xyflow/react"
import {
  Maximize,
  Download,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Layout,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import "@xyflow/react/dist/style.css"

// ============================================================================
// Custom Node Components
// ============================================================================

interface CustomNodeData {
  label: string
  subtitle: string
  icon: string
  statusState: string
  cloudTier: string
  languageRuntime: string
  frameworkLibrary: string
  databaseEngine: string
  cloudServiceName: string
  metadataTags: string[]
  reasoning: string
  purpose: string
  architectureBenefit: string
  designJustification: string
}

interface CustomNodeProps {
  data: CustomNodeData
}

const STATUS_COLORS: Record<string, string> = {
  normal: "border-gray-300 dark:border-gray-600",
  warning: "border-amber-500",
  error: "border-red-500",
  proposed: "border-blue-500 border-dashed",
}

const ICON_MAP: Record<string, React.ReactNode> = {
  user: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  browser: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>,
  mobile: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  server: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>,
  database: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>,
  queue: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a2 2 0 100 4h16a2 2 0 100-4H3zM3 10a2 2 0 100 4h16a2 2 0 100-4H3zM3 16a2 2 0 100 4h16a2 2 0 100-4H3z" /></svg>,
  microservice: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  router: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
  "load-balancer": <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  shield: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  gear: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  cloud: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>,
  file: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  terminal: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  none: null,
}

interface CustomNodeData {
  label: string
  subtitle: string
  icon: string
  statusState: string
  cloudTier: string
  languageRuntime: string
  frameworkLibrary: string
  databaseEngine: string
  cloudServiceName: string
  metadataTags: string[]
  reasoning: string
  purpose: string
  architectureBenefit: string
  designJustification: string
}

interface CustomNodeProps {
  data: CustomNodeData
}

function CustomNode({ data }: CustomNodeProps) {
  const icon = ICON_MAP[data.icon] || ICON_MAP.none
  const statusClass = STATUS_COLORS[data.statusState as keyof typeof STATUS_COLORS] || STATUS_COLORS.normal

  return (
    <div className={cn(
      "relative min-w-[240px] max-w-[320px] rounded-lg p-3 bg-white dark:bg-gray-800 shadow-md transition-all",
      "border-2", statusClass,
      "hover:shadow-lg hover:border-primary/50"
    )}>
      {/* Status indicator */}
      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800"
        style={{
          backgroundColor: data.statusState === 'error' ? '#ef4444' :
                           data.statusState === 'warning' ? '#f59e0b' :
                           data.statusState === 'proposed' ? '#3b82f6' : '#22c55e'
        }}
      />
      
      {/* Header with icon and label */}
      <div className="flex items-start gap-2 mb-2">
        {icon && <div className="w-6 h-6 text-gray-500 flex-shrink-0">{icon}</div>}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm">{data.label}</h3>
          {data.subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{data.subtitle}</p>
          )}
        </div>
      </div>

      {/* Tech Stack Tags */}
      <div className="flex flex-wrap gap-1 mb-2">
        {data.languageRuntime !== 'none' && (
          <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
            {data.languageRuntime}
          </span>
        )}
        {data.frameworkLibrary !== 'none' && (
          <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
            {data.frameworkLibrary}
          </span>
        )}
        {data.databaseEngine !== 'none' && (
          <span className="px-1.5 py-0.5 text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
            {data.databaseEngine}
          </span>
        )}
        {data.cloudServiceName !== 'none' && (
          <span className="px-1.5 py-0.5 text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded">
            {data.cloudServiceName}
          </span>
        )}
        {data.cloudTier !== 'none' && (
          <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
            {data.cloudTier}
          </span>
        )}
      </div>

      {/* Metadata Tags */}
      {data.metadataTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {data.metadataTags.map((tag, i) => (
            <span key={i} className="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded border border-gray-200 dark:border-gray-600">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Expandable Reasoning */}
      <details className="group">
        <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
          <span>Reasoning</span>
          <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </summary>
        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded text-xs text-gray-700 dark:text-gray-300 space-y-1">
          <p><strong>Why:</strong> {data.reasoning}</p>
          <p><strong>Purpose:</strong> {data.purpose}</p>
          <p><strong>Benefit:</strong> {data.architectureBenefit}</p>
          <p><strong>Design:</strong> {data.designJustification}</p>
        </div>
      </details>
    </div>
  )
}

// ============================================================================
// Custom Edge Component
// ============================================================================

interface CustomEdgeData {
  protocol: string
  flowDirection: string
  logicVariant: string
  reasoning: string
  purpose: string
  dependencyBenefit: string
  couplingJustification: string
}

interface CustomEdgeProps {
  id: string
  sourceX: number
  sourceY: number
  sourcePosition: string
  targetX: number
  targetY: number
  targetPosition: string
  label?: React.ReactNode
  data?: CustomEdgeData
}

function CustomEdge({ id, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, label, data }: CustomEdgeProps) {
  const isAnimated = data?.logicVariant !== 'standard_flow'
  const markerEnd = data?.flowDirection === 'reverse' ? MarkerType.ArrowClosed : MarkerType.ArrowClosed
  const markerStart = data?.flowDirection === 'reverse' ? MarkerType.ArrowClosed : undefined

  const pathStyle: React.CSSProperties = {
    stroke: isAnimated ? '#3b82f6' : '#9ca3af',
    strokeWidth: isAnimated ? 2 : 1.5,
    strokeDasharray: isAnimated ? '5,5' : 'none',
    markerEnd: markerEnd ? { type: markerEnd, width: 20, height: 20, color: isAnimated ? '#3b82f6' : '#9ca3af' } as any : undefined,
    markerStart: markerStart ? { type: markerStart, width: 20, height: 20, color: isAnimated ? '#3b82f6' : '#9ca3af' } as any : undefined,
  }

  // Simple bezier curve
  const getPath = () => {
    const dx = targetX - sourceX
    const dy = targetY - sourceY
    const curveAmount = Math.min(Math.max(Math.abs(dx), Math.abs(dy)) * 0.3, 150)
    
    const sourceControlX = sourceX + (sourcePosition === 'right' ? curveAmount : sourcePosition === 'left' ? -curveAmount : 0)
    const sourceControlY = sourceY + (sourcePosition === 'bottom' ? curveAmount : sourcePosition === 'top' ? -curveAmount : 0)
    const targetControlX = targetX + (targetPosition === 'left' ? curveAmount : targetPosition === 'right' ? -curveAmount : 0)
    const targetControlY = targetY + (targetPosition === 'top' ? curveAmount : targetPosition === 'bottom' ? -curveAmount : 0)

    return `M${sourceX},${sourceY} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`
  }

  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2

  return (
    <g>
      <path
        id={`${id}-path`}
        d={getPath()}
        fill="none"
        style={pathStyle}
      />
      {label && (
        <text x={midX} y={midY - 10} textAnchor="middle" className="text-xs font-medium text-gray-600 dark:text-gray-400">
          <tspan dx="-2" dy="0">{label}</tspan>
        </text>
      )}
      {data?.protocol !== 'none' && data?.protocol && (
        <text x={midX} y={midY + 12} textAnchor="middle" className="text-[9px] text-gray-400 dark:text-gray-500 font-mono">
          {data.protocol}
        </text>
      )}
    </g>
  )
}

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

  // Sync props to state
  useEffect(() => {
    if (diagramData?.nodes) setNodes(diagramData.nodes)
    if (diagramData?.edges) setEdges(diagramData.edges)
    if (diagramData?.metadata?.layoutDirection) setLayoutDirection(diagramData.metadata.layoutDirection)
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
    reactFlowInstance?.fitView({ padding: 0.1 })
  }, [reactFlowInstance])

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
            <Button variant="outline" size="icon" onClick={fitView} title="Fit view">
              <Maximize className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={toggleMinimap} title={showMinimap ? "Hide minimap" : "Show minimap"}>
              <Layout className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={toggleSidebar} title={showSidebar ? "Hide sidebar" : "Show sidebar"}>
              <Settings className="w-4 h-4" />
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
            nodeTypes={{
              default: CustomNode,
            }}
            edgeTypes={{
              default: CustomEdge,
            }}
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