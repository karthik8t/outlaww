import { Handle, Position, BaseEdge, NodeResizer, getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps, type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"
import {
  User,
  Globe,
  Smartphone,
  Server,
  Database,
  Layers,
  Cpu,
  Router,
  Shuffle,
  Shield,
  Settings,
  Cloud,
  FileText,
  Terminal,
  FolderClosed,
  AlertTriangle,
  XCircle,
  Clock,
} from "lucide-react"

// ============================================================================
// Shared types
// ============================================================================

export interface HandleConfig {
  id: string
  type: "source" | "target"
  position: "top" | "right" | "bottom" | "left"
  x: number
  y: number
}

export interface NodeData {
  id: string
  label: string
  subtitle?: string
  icon?: string
  title?: string
  description?: string
  statusState?: string
  cloudTier?: string
  languageRuntime?: string
  frameworkLibrary?: string
  databaseEngine?: string
  cloudServiceName?: string
  metadataTags?: string[]
  reasoning?: string
  purpose?: string
  architectureBenefit?: string
  designJustification?: string
  handles?: HandleConfig[]
  layoutOrientation?: string
  layoutDirection?: string
  tableName?: string
  columns?: string[]
}

export interface EdgeData {
  protocol?: string
  flowDirection?: string
  logicVariant?: string
  reasoning?: string
  purpose?: string
  dependencyBenefit?: string
  couplingJustification?: string
}

// ============================================================================
// Node Type Config — each category uses a different chart accent color
// ============================================================================

type Accent = "primary" | "chart-2" | "chart-3" | "chart-4" | "chart-5"

interface AccentSet {
  border: string
  borderSub: string
  ring: string
  text: string
  textSub: string
  shadow: string
  bg: string
  bgSub: string
  handleBorder: string
  handleBg: string
  stroke: string
  fill: string
}

const ACCENT_SETS: Record<Accent, AccentSet> = {
  primary: {
    border: "border-primary", borderSub: "border-primary/20",
    ring: "ring-primary", text: "text-primary", textSub: "text-primary/60",
    shadow: "shadow-primary/20", bg: "bg-primary/10", bgSub: "bg-primary/50",
    handleBorder: "!border-primary", handleBg: "!bg-primary",
    stroke: "stroke-primary", fill: "fill-primary",
  },
  "chart-2": {
    border: "border-chart-2", borderSub: "border-chart-2/20",
    ring: "ring-chart-2", text: "text-chart-2", textSub: "text-chart-2/60",
    shadow: "shadow-chart-2/20", bg: "bg-chart-2/10", bgSub: "bg-chart-2/50",
    handleBorder: "!border-chart-2", handleBg: "!bg-chart-2",
    stroke: "stroke-chart-2", fill: "fill-chart-2",
  },
  "chart-3": {
    border: "border-chart-3", borderSub: "border-chart-3/20",
    ring: "ring-chart-3", text: "text-chart-3", textSub: "text-chart-3/60",
    shadow: "shadow-chart-3/20", bg: "bg-chart-3/10", bgSub: "bg-chart-3/50",
    handleBorder: "!border-chart-3", handleBg: "!bg-chart-3",
    stroke: "stroke-chart-3", fill: "fill-chart-3",
  },
  "chart-4": {
    border: "border-chart-4", borderSub: "border-chart-4/20",
    ring: "ring-chart-4", text: "text-chart-4", textSub: "text-chart-4/60",
    shadow: "shadow-chart-4/20", bg: "bg-chart-4/10", bgSub: "bg-chart-4/50",
    handleBorder: "!border-chart-4", handleBg: "!bg-chart-4",
    stroke: "stroke-chart-4", fill: "fill-chart-4",
  },
  "chart-5": {
    border: "border-chart-5", borderSub: "border-chart-5/20",
    ring: "ring-chart-5", text: "text-chart-5", textSub: "text-chart-5/60",
    shadow: "shadow-chart-5/20", bg: "bg-chart-5/10", bgSub: "bg-chart-5/50",
    handleBorder: "!border-chart-5", handleBg: "!bg-chart-5",
    stroke: "stroke-chart-5", fill: "fill-chart-5",
  },
}

interface NodeTypeConfig {
  label: string
  dashed: boolean
  zIndex: number
  compact: boolean
  accent: Accent
}

const NODE_TYPE_CONFIG: Record<string, NodeTypeConfig> = {
  // Containers / groups — chart-3
  deploymentGroup: { label: "Zone",     dashed: true,  zIndex: 0,  compact: false, accent: "chart-3" },
  serviceGroup:    { label: "Cluster",  dashed: false, zIndex: 0,  compact: false, accent: "chart-3" },
  domainGroup:     { label: "Domain",   dashed: true,  zIndex: 0,  compact: false, accent: "chart-3" },
  dataGroup:       { label: "Data",     dashed: false, zIndex: 0,  compact: false, accent: "chart-3" },
  networkGroup:    { label: "Network",  dashed: true,  zIndex: 0,  compact: false, accent: "chart-3" },
  group:           { label: "Group",    dashed: true,  zIndex: 0,  compact: false, accent: "chart-3" },
  c4Boundary:      { label: "Boundary",  dashed: true,  zIndex: 0,  compact: false, accent: "chart-3" },
  cloudBoundary:   { label: "Boundary",  dashed: true,  zIndex: 0,  compact: false, accent: "chart-3" },

  // Actor — chart-4
  c4Actor:       { label: "Actor",     dashed: false, zIndex: 20, compact: true,  accent: "chart-4" },

  // C4 card nodes — primary
  c4System:      { label: "System",    dashed: false, zIndex: 10, compact: false, accent: "primary" },
  c4Container:   { label: "Container", dashed: false, zIndex: 10, compact: false, accent: "primary" },
  c4Component:   { label: "Component", dashed: false, zIndex: 10, compact: false, accent: "primary" },

  // Flow nodes — chart-5
  flowAction:    { label: "Action",    dashed: false, zIndex: 10, compact: false, accent: "chart-5" },
  flowDecision:  { label: "Decision",  dashed: false, zIndex: 10, compact: false, accent: "chart-5" },
  flowScreen:    { label: "Screen",    dashed: false, zIndex: 10, compact: false, accent: "chart-5" },

  // Swimlane — chart-4
  flowSwimlane:  { label: "Swimlane",  dashed: true,  zIndex: 1,  compact: false, accent: "chart-4" },

  // Cloud nodes — chart-2
  cloudCompute:  { label: "Compute",   dashed: false, zIndex: 10, compact: false, accent: "chart-2" },
  cloudDatabase: { label: "Database",  dashed: false, zIndex: 10, compact: false, accent: "chart-2" },
  cloudStorage:  { label: "Storage",   dashed: false, zIndex: 10, compact: false, accent: "chart-2" },
  cloudNetwork:  { label: "Network",   dashed: false, zIndex: 10, compact: false, accent: "chart-2" },
  cloudMessaging:{ label: "Messaging", dashed: false, zIndex: 10, compact: false, accent: "chart-2" },
  cloudSecurity: { label: "Security",  dashed: false, zIndex: 10, compact: false, accent: "chart-2" },
  cloudAnalytics:{ label: "Analytics", dashed: false, zIndex: 10, compact: false, accent: "chart-2" },
}

const DEFAULT_NODE_CONFIG: NodeTypeConfig = {
  label: "Node", dashed: false, zIndex: 10, compact: false, accent: "primary",
}

function getNodeConfig(nodeType: string): NodeTypeConfig {
  return NODE_TYPE_CONFIG[nodeType] || DEFAULT_NODE_CONFIG
}

function getAccentSet(nodeType: string): AccentSet {
  return ACCENT_SETS[getNodeConfig(nodeType).accent]
}

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  warning: AlertTriangle,
  error: XCircle,
  proposed: Clock,
}

const STATUS_COLORS: Record<string, string> = {
  warning: "text-chart-4",
  error: "text-destructive",
  proposed: "text-primary",
}

// ============================================================================
// Handle
// ============================================================================

function resolveHandlePosition(layoutDirection: string | undefined, handleType: "source" | "target"): Position {
  const dir = layoutDirection?.toUpperCase() || "LR"
  if (dir === "TB") return handleType === "source" ? Position.Bottom : Position.Top
  if (dir === "BT") return handleType === "source" ? Position.Top   : Position.Bottom
  if (dir === "RL") return handleType === "source" ? Position.Left  : Position.Right
  return handleType === "source" ? Position.Right : Position.Left
}

function handleStyle(position: Position): React.CSSProperties {
  switch (position) {
    case Position.Top:    return { left: "50%", top: 0,    transform: "translate(-50%, -50%)" }
    case Position.Bottom: return { left: "50%", bottom: 0, top: "auto", transform: "translate(-50%, 50%)" }
    case Position.Left:   return { top: "50%",  left: 0,   transform: "translate(-50%, -50%)" }
    case Position.Right:  return { top: "50%",  right: 0,  left: "auto", transform: "translate(50%, -50%)" }
  }
}

function NodeHandle({ h, layoutDirection, accent }: { h: HandleConfig; layoutDirection?: string; accent: AccentSet }) {
  const resolvedPosition = resolveHandlePosition(layoutDirection, h.type)
  const style = handleStyle(resolvedPosition)
  return (
    <Handle
      key={h.id}
      id={h.id}
      type={h.type}
      position={resolvedPosition}
      style={{
        ...style,
        width: 10,
        height: 10,
        borderWidth: 2,
        opacity: 0,
        transition: "opacity 0.15s ease",
      }}
      className={cn(accent.handleBorder, "!bg-card !z-10 group-hover:!opacity-100")}
    />
  )
}

// ============================================================================
// Icon Maps
// ============================================================================

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  user: User,
  browser: Globe,
  mobile: Smartphone,
  server: Server,
  database: Database,
  queue: Layers,
  microservice: Cpu,
  router: Router,
  "load-balancer": Shuffle,
  shield: Shield,
  gear: Settings,
  cloud: Cloud,
  file: FileText,
  terminal: Terminal,
}

const GROUP_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  deploymentGroup: Globe,
  serviceGroup: Layers,
  domainGroup: FolderClosed,
  dataGroup: Database,
  networkGroup: Router,
  c4Boundary: Shield,
  cloudBoundary: Cloud,
}

// ============================================================================
// Spec row builder
// ============================================================================

interface SpecRow {
  label: string
  value: string
}

function buildActorSpecs(data: NodeData): SpecRow[] {
  const rows: SpecRow[] = []
  if (data.cloudServiceName && data.cloudServiceName !== "none") rows.push({ label: "Provider", value: data.cloudServiceName })
  return rows
}

function buildCardSpecs(data: NodeData): SpecRow[] {
  const rows: SpecRow[] = []
  if (data.languageRuntime && data.languageRuntime !== "none") {
    const fw = data.frameworkLibrary && data.frameworkLibrary !== "none" ? `, ${data.frameworkLibrary}` : ""
    rows.push({ label: "Tech", value: `${data.languageRuntime}${fw}` })
  } else if (data.frameworkLibrary && data.frameworkLibrary !== "none") {
    rows.push({ label: "Tech", value: data.frameworkLibrary })
  }
  if (data.cloudServiceName && data.cloudServiceName !== "none") rows.push({ label: "Provider", value: data.cloudServiceName })
  if (data.databaseEngine && data.databaseEngine !== "none") rows.push({ label: "Engine", value: data.databaseEngine })
  if (data.cloudTier && data.cloudTier !== "none") rows.push({ label: "Tier", value: data.cloudTier })
  if (data.tableName) rows.push({ label: "Table", value: data.tableName })
  if (data.statusState) {
    const labels: Record<string, string> = { normal: "Healthy", warning: "High Latency", error: "Critical", proposed: "Proposed" }
    rows.push({ label: "Status", value: labels[data.statusState] || data.statusState })
  }
  return rows
}

// ============================================================================
// Actor Node — Small compact blueprint card
// ============================================================================

function ActorNode({ data, selected, accent }: { data: NodeData; selected?: boolean; accent: AccentSet }) {
  const IconComponent = data.icon ? ICON_MAP[data.icon] : null
  const specs = buildActorSpecs(data)

  return (
    <div
      className={cn(
        "group relative bg-card border-2 rounded-sm",
        "shadow-[2px_2px_0px_0px]",
        "min-w-[140px]",
        accent.border, accent.shadow,
        selected && cn("ring-2", accent.ring),
      )}
    >
      {(data.handles || []).map((h) => (
        <NodeHandle key={h.id} h={h} layoutDirection={data.layoutDirection} accent={accent} />
      ))}
      <div className={cn("bg-muted border-b p-2 flex items-center justify-between", accent.border)}>
        <span className={cn("font-mono text-[10px] font-bold uppercase tracking-wider", accent.text)}>
          {data.subtitle || "Actor"}
        </span>
        {IconComponent && (
          <IconComponent className={cn("w-4 h-4", accent.text)} />
        )}
      </div>
      <div className="p-3">
        <div className={cn("font-mono text-sm font-bold text-center leading-tight", accent.text)}>
          {data.label}
        </div>
        {data.description && (
          <div className="font-mono text-[10px] text-muted-foreground text-center mt-1 leading-tight">
            {data.description}
          </div>
        )}
        {specs.length > 0 && (
          <div className="mt-2 text-[10px] font-mono">
            {specs.map(s => (
              <div key={s.label} className="text-muted-foreground text-center">{s.value}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Card Node — Blueprint card with properties table
// ============================================================================

function CardNode({ data, selected, nodeType, accent }: { data: NodeData; selected?: boolean; nodeType: string; accent: AccentSet }) {
  const cfg = getNodeConfig(nodeType)
  const IconComponent = data.icon ? ICON_MAP[data.icon] : null
  const specs = buildCardSpecs(data)
  const StatusIcon = data.statusState ? STATUS_ICONS[data.statusState] : null
  const statusColor = data.statusState ? STATUS_COLORS[data.statusState] : ""

  return (
    <div
      className={cn(
        "group relative bg-card border-2 rounded-sm",
        "shadow-[2px_2px_0px_0px]",
        "min-w-[240px]",
        accent.border, accent.shadow,
        cfg.dashed ? "border-dashed" : "border-solid",
        selected && cn("ring-2", accent.ring),
      )}
    >
      {(data.handles || []).map((h) => (
        <NodeHandle key={h.id} h={h} layoutDirection={data.layoutDirection} accent={accent} />
      ))}

      {/* Header */}
      <div className={cn("bg-muted border-b p-2 flex items-center justify-between", accent.border)}>
        <div className="flex items-center gap-2 min-w-0">
          {IconComponent && (
            <IconComponent className={cn("w-4 h-4 shrink-0", accent.text)} />
          )}
          <span className={cn("font-mono text-[10px] font-bold uppercase tracking-wider", accent.text)}>
            {cfg.label}
          </span>
        </div>
        {StatusIcon && (
          <StatusIcon className={cn("w-4 h-4 shrink-0", statusColor)} />
        )}
      </div>

      {/* Title area */}
      {(data.label || data.purpose || data.description) && (
        <div className={cn("p-2 border-b", accent.borderSub)}>
          <div className={cn("font-mono text-sm font-bold leading-tight", accent.text)}>
            {data.label}
          </div>
          {(data.purpose || data.description) && (
            <div className="font-mono text-[10px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
              {data.purpose || data.description}
            </div>
          )}
        </div>
      )}

      {/* Properties table */}
      {specs.length > 0 && (
        <div className="flex flex-col text-[10px] font-mono">
          {specs.slice(0, 3).map((s, i) => (
            <div key={s.label} className={cn("flex", i < specs.length - 1 && i < 2 ? cn("border-b", accent.borderSub) : "")}>
              <div className={cn("w-[35%] p-1.5 border-r bg-muted/50 font-semibold", accent.borderSub, accent.text)}>{s.label}</div>
              <div className="w-[65%] p-1.5 text-foreground">{s.value}</div>
            </div>
          ))}
          {specs.length > 3 && (
            <div className={cn("p-1.5 text-center text-[9px] font-mono border-t", accent.textSub, accent.borderSub)}>
              +{specs.length - 3} more
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Container Node — Blueprint container
// ============================================================================

function ContainerNode({ data, selected, nodeType, accent }: { data: NodeData; selected?: boolean; nodeType: string; accent: AccentSet }) {
  const cfg = getNodeConfig(nodeType)
  const GroupIcon = GROUP_ICON_MAP[nodeType] || FolderClosed

  return (
    <div
      className={cn(
        "group w-full h-full border-2 bg-card transition-shadow relative rounded-sm",
        cfg.dashed ? "border-dashed" : "border-solid",
        accent.border,
        selected && cn("ring-2", accent.ring),
      )}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={280}
        minHeight={160}
        lineClassName={accent.handleBorder}
        handleClassName={cn(accent.handleBg, "!w-3 !h-3 !border-2 !border-card")}
      />
      {(data.handles || []).map((h) => (
        <NodeHandle key={h.id} h={h} layoutDirection={data.layoutDirection} accent={accent} />
      ))}

      <div className={cn(
        "rf-group-drag-handle",
        "flex items-center gap-3 px-3 py-2 border-b-2",
        "bg-muted cursor-grab active:cursor-grabbing select-none",
        accent.border,
      )}>
        <GroupIcon className={cn("w-4 h-4 shrink-0", accent.text)} />
        <span className={cn("text-sm font-bold truncate font-mono", accent.text)}>
          {data.label}
        </span>
        <span className={cn("ml-auto text-[9px] font-bold uppercase tracking-wider font-mono", accent.text)}>
          {cfg.label}
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// Group Node
// ============================================================================

function GroupNode({ data, selected, nodeType, accent }: { data: NodeData; selected?: boolean; nodeType: string; accent: AccentSet }) {
  const cfg = getNodeConfig(nodeType)

  return (
    <div
      className={cn(
        "relative w-full h-full border-2 border-dashed bg-card rounded-sm transition-shadow",
        accent.border,
        selected && cn("ring-2", accent.ring),
      )}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={240}
        minHeight={120}
        lineClassName={accent.handleBorder}
        handleClassName={cn(accent.handleBg, "!w-3 !h-3 !border-2 !border-card")}
      />
      <div className={cn("flex items-center gap-2 px-3 py-2 border-b-2 border-dashed bg-muted", accent.border)}>
        <span className={cn("text-[9px] font-bold uppercase tracking-wider font-mono", accent.text)}>
          {cfg.label}
        </span>
        <span className={cn("text-sm font-bold truncate font-mono", accent.text)}>{data.label}</span>
      </div>
      {data.title && (
        <div className={cn("px-3 py-2 border-b border-dashed", accent.borderSub)}>
          <h4 className={cn("text-xs font-semibold", accent.text)}>{data.title}</h4>
        </div>
      )}
      {data.description && (
        <div className="px-3 py-2">
          <p className="text-xs text-foreground">{data.description}</p>
        </div>
      )}
      {data.purpose && !data.title && !data.description && (
        <div className="px-3 py-2">
          <p className="text-[11px] text-muted-foreground">{data.purpose}</p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Swimlane Node
// ============================================================================

function SwimlaneNode({ data, selected, accent }: { data: NodeData; selected?: boolean; accent: AccentSet }) {
  const isHorizontal = data.layoutOrientation !== "vertical"

  return (
    <div
      className={cn(
        "relative flex bg-card border-2 rounded-sm transition-shadow min-h-[50px]",
        isHorizontal ? "flex-row" : "flex-col",
        accent.border,
        selected && cn("ring-2", accent.ring),
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center font-bold uppercase tracking-wider bg-muted font-mono",
          accent.text,
          isHorizontal
            ? cn("w-8 min-h-full border-r-2 text-[9px] [writing-mode:vertical-rl]", accent.border)
            : cn("h-7 w-full border-b-2 text-[9px]", accent.border),
        )}
      >
        {data.label || "Swimlane"}
      </div>
    </div>
  )
}

// ============================================================================
// Node dispatch
// ============================================================================

const CONTAINER_TYPES = new Set([
  "deploymentGroup", "serviceGroup", "domainGroup", "dataGroup", "networkGroup",
  "c4Boundary", "cloudBoundary",
])

const ACTOR_TYPES = new Set(["c4Actor"])

function DiagramNode(props: NodeProps) {
  const { data, selected, type } = props
  const isContainer = CONTAINER_TYPES.has(type || "")
  const isSwimlane = type === "flowSwimlane"
  const isLegacyGroup = type === "group"
  const isActor = ACTOR_TYPES.has(type || "")

  const nodeData = data as any as NodeData
  const accent = getAccentSet(type || "c4Container")

  if (isActor)     return <ActorNode data={nodeData} selected={selected} accent={accent} />
  if (isContainer) return <ContainerNode data={nodeData} selected={selected} nodeType={type || "group"} accent={accent} />
  if (isSwimlane)  return <SwimlaneNode data={nodeData} selected={selected} accent={accent} />
  if (isLegacyGroup) return <GroupNode data={nodeData} selected={selected} nodeType={type || "group"} accent={accent} />

  return <CardNode data={nodeData} selected={selected} nodeType={type || "c4Container"} accent={accent} />
}

export const nodeTypes = {
  deploymentGroup: DiagramNode,
  serviceGroup: DiagramNode,
  domainGroup: DiagramNode,
  dataGroup: DiagramNode,
  networkGroup: DiagramNode,
  group: DiagramNode,
  c4Actor: DiagramNode,
  c4System: DiagramNode,
  c4Container: DiagramNode,
  c4Component: DiagramNode,
  c4Boundary: DiagramNode,
  flowAction: DiagramNode,
  flowDecision: DiagramNode,
  flowScreen: DiagramNode,
  flowSwimlane: DiagramNode,
  cloudCompute: DiagramNode,
  cloudDatabase: DiagramNode,
  cloudStorage: DiagramNode,
  cloudNetwork: DiagramNode,
  cloudMessaging: DiagramNode,
  cloudSecurity: DiagramNode,
  cloudAnalytics: DiagramNode,
  cloudBoundary: DiagramNode,
}

// ============================================================================
// Custom Edge — Blueprint navy style
// ============================================================================

function getEdgePath(type: string, props: any) {
  switch (type) {
    case "smoothstep": return getSmoothStepPath(props)
    case "step":       return getStraightPath(props)
    case "straight":   return getStraightPath(props)
    default:           return getBezierPath(props)
  }
}

function edgePathStyle(edgeData: EdgeData | undefined): React.CSSProperties {
  const dashed = !!(edgeData?.logicVariant && edgeData.logicVariant !== "standard_flow")
  return {
    strokeWidth: 1.5,
    fill: "none",
    strokeDasharray: dashed ? "4 2" : undefined,
  }
}

export function CustomEdge(props: EdgeProps) {
  const {
    id, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
    label, data, selected, animated, type: edgeType,
  } = props
  const edgeData = data as EdgeData | undefined
  const pathType = edgeType || "default"

  const [edgePath, labelX, labelY] = getEdgePath(pathType, {
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const hasLabel = !!label
  const hasProtocol = !!(edgeData?.protocol && edgeData.protocol !== "none")
  const labelStr = label as string | undefined
  const protocolStr = edgeData?.protocol

  const labelW = Math.max(40, (labelStr?.length ?? 0) * 6.5 + 16)
  const protocolW = Math.max(32, (protocolStr?.length ?? 0) * 5.5 + 14)
  const labelH = 20

  return (
    <g>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...edgePathStyle(edgeData),
          animation: animated ? "dashdraw 0.5s linear infinite" : undefined,
        }}
        markerEnd="url(#arrowhead)"
        className={cn("stroke-primary", selected && "!opacity-80")}
      />

      {hasLabel && (
        <g transform={`translate(${labelX}, ${labelY - 6})`}>
          <rect
            x={-labelW / 2} y={-labelH / 2}
            width={labelW} height={labelH}
            rx={2}
            className="fill-card stroke-primary"
            strokeWidth={1}
          />
          <text
            x={0} y={4}
            textAnchor="middle"
            className="fill-primary font-semibold"
            style={{ fontSize: "10px", fontFamily: "JetBrains Mono, monospace" }}
          >
            {labelStr}
          </text>
        </g>
      )}

      {hasProtocol && (
        <g transform={`translate(${labelX}, ${labelY + (hasLabel ? 12 : -6)})`}>
          <rect
            x={-protocolW / 2} y={-8}
            width={protocolW} height={16}
            rx={2}
            className="fill-card stroke-primary"
            strokeWidth={0.75}
          />
          <text
            x={0} y={3.5}
            textAnchor="middle"
            className="fill-primary"
            style={{ fontSize: "9px", fontFamily: "JetBrains Mono, monospace" }}
          >
            {protocolStr}
          </text>
        </g>
      )}

      <defs>
        <marker id="arrowhead" markerHeight="6" markerWidth="9" orient="auto" refX="8" refY="3">
          <polygon className="fill-primary" points="0 0, 9 3, 0 6" />
        </marker>
      </defs>
    </g>
  )
}

export const edgeTypes = {
  default: CustomEdge,
  straight: CustomEdge,
  step: CustomEdge,
  smoothstep: CustomEdge,
  simplebezier: CustomEdge,
}

// ============================================================================
// SVG animation keyframes
// ============================================================================

const styleId = "rf-edge-dash-animation"
if (typeof document !== "undefined" && !document.getElementById(styleId)) {
  const styleEl = document.createElement("style")
  styleEl.id = styleId
  styleEl.textContent = `
    @keyframes dashdraw {
      from { stroke-dashoffset: 10; }
      to   { stroke-dashoffset: 0; }
    }
    .react-flow__node:hover .group-hover\\:opacity-100 {
      opacity: 1 !important;
    }
  `
  document.head.appendChild(styleEl)
}
