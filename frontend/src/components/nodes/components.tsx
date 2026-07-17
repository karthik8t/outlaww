import { Handle, Position, BaseEdge, getBezierPath, getSmoothStepPath, getStraightPath, getEdgeCenter, type EdgeProps, type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"

// ============================================================================
// Shared types — matches the post-processor's camelCase data shape
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
// Node Type Config — single registry for theme, label, dashed, zIndex
// Customize any per-type value here.
// ============================================================================

interface NodeTheme {
  badge: string
  badgeText: string
  accent: string
  border: string
  light: string
}

interface NodeTypeConfig {
  label: string
  dashed: boolean
  zIndex: number
  theme: NodeTheme
}

const NODE_TYPE_CONFIG: Record<string, NodeTypeConfig> = {
  c4Actor:       { label: "Actor",    dashed: false, zIndex: 20, theme: { badge: "bg-indigo-100 dark:bg-indigo-900/40", badgeText: "text-indigo-700 dark:text-indigo-300", accent: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-400 dark:border-indigo-500", light: "bg-indigo-50/50 dark:bg-indigo-950/20" } },
  c4System:      { label: "System",   dashed: false, zIndex: 10, theme: { badge: "bg-indigo-100 dark:bg-indigo-900/40", badgeText: "text-indigo-700 dark:text-indigo-300", accent: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-400 dark:border-indigo-500", light: "bg-indigo-50/50 dark:bg-indigo-950/20" } },
  c4Container:   { label: "Container",dashed: false, zIndex: 10, theme: { badge: "bg-violet-100 dark:bg-violet-900/40", badgeText: "text-violet-700 dark:text-violet-300", accent: "text-violet-600 dark:text-violet-400", border: "border-violet-400 dark:border-violet-500", light: "bg-violet-50/50 dark:bg-violet-950/20" } },
  c4Component:   { label: "Component",dashed: false, zIndex: 10, theme: { badge: "bg-purple-100 dark:bg-purple-900/40", badgeText: "text-purple-700 dark:text-purple-300", accent: "text-purple-600 dark:text-purple-400", border: "border-purple-400 dark:border-purple-500", light: "bg-purple-50/50 dark:bg-purple-950/20" } },
  c4Boundary:    { label: "Boundary", dashed: true,  zIndex: 0,  theme: { badge: "bg-fuchsia-100 dark:bg-fuchsia-900/40", badgeText: "text-fuchsia-700 dark:text-fuchsia-300", accent: "text-fuchsia-600 dark:text-fuchsia-400", border: "border-fuchsia-300 dark:border-fuchsia-500/60", light: "bg-fuchsia-50/40 dark:bg-fuchsia-950/10" } },
  flowAction:    { label: "Action",   dashed: false, zIndex: 10, theme: { badge: "bg-amber-100 dark:bg-amber-900/40", badgeText: "text-amber-700 dark:text-amber-300", accent: "text-amber-600 dark:text-amber-400", border: "border-amber-400 dark:border-amber-500", light: "bg-amber-50/50 dark:bg-amber-950/20" } },
  flowDecision:  { label: "Decision", dashed: false, zIndex: 10, theme: { badge: "bg-red-100 dark:bg-red-900/40", badgeText: "text-red-700 dark:text-red-300", accent: "text-red-600 dark:text-red-400", border: "border-red-400 dark:border-red-500", light: "bg-red-50/50 dark:bg-red-950/20" } },
  flowScreen:    { label: "Screen",   dashed: false, zIndex: 10, theme: { badge: "bg-emerald-100 dark:bg-emerald-900/40", badgeText: "text-emerald-700 dark:text-emerald-300", accent: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-400 dark:border-emerald-500", light: "bg-emerald-50/50 dark:bg-emerald-950/20" } },
  flowSwimlane:  { label: "Swimlane", dashed: true,  zIndex: 1,  theme: { badge: "bg-gray-200 dark:bg-gray-700", badgeText: "text-gray-600 dark:text-gray-300", accent: "text-gray-600 dark:text-gray-400", border: "border-gray-300 dark:border-gray-600", light: "bg-gray-50 dark:bg-gray-900/30" } },
  cloudCompute:  { label: "Compute",  dashed: false, zIndex: 10, theme: { badge: "bg-blue-100 dark:bg-blue-900/40", badgeText: "text-blue-700 dark:text-blue-300", accent: "text-blue-600 dark:text-blue-400", border: "border-blue-400 dark:border-blue-500", light: "bg-blue-50/50 dark:bg-blue-950/20" } },
  cloudDatabase: { label: "Database", dashed: false, zIndex: 10, theme: { badge: "bg-cyan-100 dark:bg-cyan-900/40", badgeText: "text-cyan-700 dark:text-cyan-300", accent: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-400 dark:border-cyan-500", light: "bg-cyan-50/50 dark:bg-cyan-950/20" } },
  cloudStorage:  { label: "Storage",  dashed: false, zIndex: 10, theme: { badge: "bg-violet-100 dark:bg-violet-900/40", badgeText: "text-violet-700 dark:text-violet-300", accent: "text-violet-600 dark:text-violet-400", border: "border-violet-400 dark:border-violet-500", light: "bg-violet-50/50 dark:bg-violet-950/20" } },
  cloudNetwork:  { label: "Network",  dashed: false, zIndex: 10, theme: { badge: "bg-teal-100 dark:bg-teal-900/40", badgeText: "text-teal-700 dark:text-teal-300", accent: "text-teal-600 dark:text-teal-400", border: "border-teal-400 dark:border-teal-500", light: "bg-teal-50/50 dark:bg-teal-950/20" } },
  cloudMessaging:{ label: "Messaging",dashed: false, zIndex: 10, theme: { badge: "bg-orange-100 dark:bg-orange-900/40", badgeText: "text-orange-700 dark:text-orange-300", accent: "text-orange-600 dark:text-orange-400", border: "border-orange-400 dark:border-orange-500", light: "bg-orange-50/50 dark:bg-orange-950/20" } },
  cloudSecurity: { label: "Security", dashed: false, zIndex: 10, theme: { badge: "bg-slate-200 dark:bg-slate-700", badgeText: "text-slate-600 dark:text-slate-300", accent: "text-slate-600 dark:text-slate-400", border: "border-slate-400 dark:border-slate-500", light: "bg-slate-50 dark:bg-slate-950/20" } },
  cloudAnalytics:{ label: "Analytics",dashed: false, zIndex: 10, theme: { badge: "bg-pink-100 dark:bg-pink-900/40", badgeText: "text-pink-700 dark:text-pink-300", accent: "text-pink-600 dark:text-pink-400", border: "border-pink-400 dark:border-pink-500", light: "bg-pink-50/50 dark:bg-pink-950/20" } },
  cloudBoundary: { label: "Boundary", dashed: true,  zIndex: 0,  theme: { badge: "bg-gray-200 dark:bg-gray-700", badgeText: "text-gray-500 dark:text-gray-400", accent: "text-gray-500 dark:text-gray-400", border: "border-gray-300 dark:border-gray-600", light: "bg-gray-50 dark:bg-gray-900/20" } },
}

const DEFAULT_NODE_CONFIG: NodeTypeConfig = {
  label: "Node", dashed: false, zIndex: 10,
  theme: { badge: "bg-gray-100 dark:bg-gray-800", badgeText: "text-gray-600 dark:text-gray-300", accent: "text-gray-600 dark:text-gray-400", border: "border-gray-300 dark:border-gray-600", light: "bg-gray-50 dark:bg-gray-900/10" },
}

function getNodeConfig(nodeType: string): NodeTypeConfig {
  return NODE_TYPE_CONFIG[nodeType] || DEFAULT_NODE_CONFIG
}

const STATUS_CLASSES: Record<string, string> = {
  normal: "bg-green-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  proposed: "bg-blue-500",
}

// ============================================================================
// Handle helpers
// ============================================================================

function NodeHandle(h: HandleConfig) {
  return (
    <Handle
      key={h.id}
      id={h.id}
      type={h.type}
      position={h.position}
      style={{
        left: `${h.x * 100}%`,
        top: `${h.y * 100}%`,
        width: 10, height: 10, borderWidth: 2,
        transform: "translate(-50%, -50%)",
      }}
      className="!border-border !bg-background !z-10"
    />
  )
}

// ============================================================================
// Card Node — standard card for all content-bearing nodes
// ============================================================================

function CardNode({ data, selected, nodeType }: { data: NodeData; selected?: boolean; nodeType: string }) {
  const cfg = getNodeConfig(nodeType)
  const { theme } = cfg
  const handles = (data.handles || []) as HandleConfig[]

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow",
        cfg.dashed ? "border-dashed" : "border-solid",
        "min-w-[220px] max-w-[300px]",
        selected && "ring-2 ring-ring shadow-md",
        !selected && "hover:shadow-md",
        theme.border,
      )}
    >
      {handles.map(NodeHandle)}

      <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", theme.accent.replace("text-", "bg-"))} />

      <div className="p-3 pl-4">
        <div className="flex items-center justify-between mb-2">
          <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-widest", theme.badge, theme.badgeText)}>
            {data.icon && <span className="text-xs">{data.icon}</span>}
            {cfg.label}
          </span>
          {data.statusState && (
            <span className={cn("w-2 h-2 rounded-full", STATUS_CLASSES[data.statusState] || STATUS_CLASSES.normal)} />
          )}
        </div>

        <div className="mb-1.5">
          <h3 className={cn("text-sm font-semibold truncate", theme.accent)}>
            {data.label}
          </h3>
          {data.subtitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{data.subtitle}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {data.languageRuntime && data.languageRuntime !== "none" && (
            <Tag theme={theme}>{data.languageRuntime}</Tag>
          )}
          {data.frameworkLibrary && data.frameworkLibrary !== "none" && (
            <Tag className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">{data.frameworkLibrary}</Tag>
          )}
          {data.databaseEngine && data.databaseEngine !== "none" && (
            <Tag className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300">{data.databaseEngine}</Tag>
          )}
          {data.cloudServiceName && data.cloudServiceName !== "none" && (
            <Tag className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">{data.cloudServiceName}</Tag>
          )}
          {data.cloudTier && data.cloudTier !== "none" && (
            <Tag theme={theme}>{data.cloudTier}</Tag>
          )}
          {data.metadataTags && data.metadataTags.slice(0, 3).map((tag, i) => (
            <Tag key={i} className="bg-muted text-muted-foreground border border-border">{tag}</Tag>
          ))}
          {data.metadataTags && data.metadataTags.length > 3 && (
            <Tag className="bg-muted text-muted-foreground">+{data.metadataTags.length - 3}</Tag>
          )}
        </div>

        {data.tableName && (
          <div className="mt-1.5 text-[10px] font-mono text-muted-foreground truncate">
            {data.tableName}
            {data.columns && data.columns.length > 0 && ` (${data.columns.join(", ")})`}
          </div>
        )}
      </div>
    </div>
  )
}

function Tag({ children, className, theme }: { children: React.ReactNode; className?: string; theme?: NodeTheme }) {
  return (
    <span className={cn("px-1.5 py-0.5 text-[10px] font-medium rounded", theme?.badge, theme?.badgeText, className)}>
      {children}
    </span>
  )
}

// ============================================================================
// Boundary Node — transparent container that groups children
// ============================================================================

function BoundaryNode({ data, selected, nodeType }: { data: NodeData; selected?: boolean; nodeType: string }) {
  const cfg = getNodeConfig(nodeType)
  const { theme } = cfg

  return (
    <div
      className={cn(
        "relative min-w-[300px] min-h-[160px] rounded-xl border-2 border-dashed transition-shadow",
        selected && "ring-2 ring-ring shadow-md",
        theme.border, theme.light,
      )}
    >
      <div className={cn("px-3 py-1.5 border-b border-dashed flex items-center gap-2", theme.border)}>
        <span className={cn("text-[10px] font-semibold uppercase tracking-widest", theme.badgeText)}>
          {cfg.label}
        </span>
        <span className="text-xs text-muted-foreground font-medium truncate">{data.label}</span>
      </div>
    </div>
  )
}

// ============================================================================
// Swimlane Node — horizontal lane with a side label
// ============================================================================

function SwimlaneNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  const isHorizontal = data.layoutOrientation !== "vertical"

  return (
    <div
      className={cn(
        "relative flex rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/30 transition-shadow min-h-[100px]",
        isHorizontal ? "flex-row" : "flex-col",
        selected && "ring-2 ring-ring shadow-md",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center font-semibold text-muted-foreground",
          isHorizontal
            ? "w-8 min-h-full border-r border-gray-300 dark:border-gray-600 text-[10px] [writing-mode:vertical-rl] tracking-widest uppercase"
            : "h-7 w-full border-b border-gray-300 dark:border-gray-600 text-[10px] tracking-widest uppercase",
        )}
      >
        {data.label || "Swimlane"}
      </div>
    </div>
  )
}

// ============================================================================
// Node dispatch — routes to the correct renderer based on type
// ============================================================================

function DiagramNode(props: NodeProps) {
  const { data, selected, type } = props
  const isBoundary = type === "c4Boundary" || type === "cloudBoundary"
  const isSwimlane = type === "flowSwimlane"

  if (isBoundary) return <BoundaryNode data={data} selected={selected} nodeType={type} />
  if (isSwimlane) return <SwimlaneNode data={data} selected={selected} />

  return <CardNode data={data} selected={selected} nodeType={type} />
}

export const nodeTypes = {
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
// Custom edge — renders path + label + protocol, with frontend-styled path
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
  if (!edgeData) return {}
  const style: React.CSSProperties = {}
  if (edgeData.logicVariant && edgeData.logicVariant !== "standard_flow") {
    style.strokeDasharray = "5,5"
    style.stroke = "#3b82f6"
  } else {
    style.stroke = "#9ca3af"
  }
  if (edgeData.protocol === "gRPC" || edgeData.protocol === "WebSocket") {
    style.stroke = "#8b5cf6"
  }
  return style
}

export function CustomEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, label, data, selected, markerEnd, markerStart, animated, type: edgeType } = props
  const edgeData = data as EdgeData | undefined
  const pathType = edgeType || "default"

  const [edgePath] = getEdgePath(pathType, {
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const [cx, cy] = getEdgeCenter({ sourceX, sourceY, targetX, targetY })

  return (
    <g>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ ...edgePathStyle(edgeData), animation: animated ? "dashdraw 0.5s linear infinite" : undefined }}
        markerEnd={markerEnd}
        markerStart={markerStart}
        className={cn(selected && "!stroke-foreground/70")}
      />
      {label && (
        <g>
          <rect x={cx - 30} y={cy - 14} width={60} height={22} rx={4}
            className="fill-background/90 stroke-border" strokeWidth={0.5} />
          <text x={cx} y={cy - 2} textAnchor="middle" className="fill-foreground/80 text-[10px] font-semibold leading-none">
            {label as string}
          </text>
        </g>
      )}
      {edgeData?.protocol && edgeData.protocol !== "none" && (
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-muted-foreground/60 text-[9px] font-mono">
          {edgeData.protocol}
        </text>
      )}
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
// SVG animation keyframes — injected once
// ============================================================================

const styleId = "rf-edge-dash-animation"
if (typeof document !== "undefined" && !document.getElementById(styleId)) {
  const style = document.createElement("style")
  style.id = styleId
  style.textContent = `
    @keyframes dashdraw {
      from { stroke-dashoffset: 10; }
      to { stroke-dashoffset: 0; }
    }
  `
  document.head.appendChild(style)
}
