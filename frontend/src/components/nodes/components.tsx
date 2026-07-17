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
  title?: string // optional title for group nodes
  description?: string // optional description
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
  layoutDirection?: string  // injected by ReactFlowDiagramView after every layout run
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
// ============================================================================

interface NodeTheme {
  badge: string
  badgeText: string
  accent: string
  border: string
  light: string
  accentBg: string  // pre-computed accent background (used for the stripe)
}

interface NodeTypeConfig {
  label: string
  dashed: boolean
  zIndex: number
  theme: NodeTheme
}

const NODE_TYPE_CONFIG: Record<string, NodeTypeConfig> = {
  // ── Legacy generic group ────────────────────────────────────────────────
  group: {
    label: "Group",
    dashed: true,
    zIndex: 0,
    theme: {
      badge: "bg-gray-200 dark:bg-gray-700",
      badgeText: "text-gray-600 dark:text-gray-300",
      accent: "text-gray-600 dark:text-gray-400",
      border: "border-gray-400 dark:border-gray-500",
      light: "bg-gray-50 dark:bg-gray-900/20",
      accentBg: "bg-gray-400 dark:bg-gray-500",
    },
  },
  c4Actor:       { label: "Actor",    dashed: false, zIndex: 20, theme: { badge: "bg-indigo-100 dark:bg-indigo-900/40", badgeText: "text-indigo-700 dark:text-indigo-300", accent: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-400 dark:border-indigo-500", light: "bg-indigo-50/50 dark:bg-indigo-950/20", accentBg: "bg-indigo-400 dark:bg-indigo-500" } },
  c4System:      { label: "System",   dashed: false, zIndex: 10, theme: { badge: "bg-indigo-100 dark:bg-indigo-900/40", badgeText: "text-indigo-700 dark:text-indigo-300", accent: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-400 dark:border-indigo-500", light: "bg-indigo-50/50 dark:bg-indigo-950/20", accentBg: "bg-indigo-400 dark:bg-indigo-500" } },
  c4Container:   { label: "Container",dashed: false, zIndex: 10, theme: { badge: "bg-violet-100 dark:bg-violet-900/40", badgeText: "text-violet-700 dark:text-violet-300", accent: "text-violet-600 dark:text-violet-400", border: "border-violet-400 dark:border-violet-500", light: "bg-violet-50/50 dark:bg-violet-950/20", accentBg: "bg-violet-400 dark:bg-violet-500" } },
  c4Component:   { label: "Component",dashed: false, zIndex: 10, theme: { badge: "bg-purple-100 dark:bg-purple-900/40", badgeText: "text-purple-700 dark:text-purple-300", accent: "text-purple-600 dark:text-purple-400", border: "border-purple-400 dark:border-purple-500", light: "bg-purple-50/50 dark:bg-purple-950/20", accentBg: "bg-purple-400 dark:bg-purple-500" } },
  c4Boundary:    { label: "Boundary", dashed: true,  zIndex: 0,  theme: { badge: "bg-fuchsia-100 dark:bg-fuchsia-900/40", badgeText: "text-fuchsia-700 dark:text-fuchsia-300", accent: "text-fuchsia-600 dark:text-fuchsia-400", border: "border-fuchsia-300 dark:border-fuchsia-500/60", light: "bg-fuchsia-50/40 dark:bg-fuchsia-950/10", accentBg: "bg-fuchsia-400 dark:bg-fuchsia-500" } },
  flowAction:    { label: "Action",   dashed: false, zIndex: 10, theme: { badge: "bg-amber-100 dark:bg-amber-900/40", badgeText: "text-amber-700 dark:text-amber-300", accent: "text-amber-600 dark:text-amber-400", border: "border-amber-400 dark:border-amber-500", light: "bg-amber-50/50 dark:bg-amber-950/20", accentBg: "bg-amber-400 dark:bg-amber-500" } },
  flowDecision:  { label: "Decision", dashed: false, zIndex: 10, theme: { badge: "bg-red-100 dark:bg-red-900/40", badgeText: "text-red-700 dark:text-red-300", accent: "text-red-600 dark:text-red-400", border: "border-red-400 dark:border-red-500", light: "bg-red-50/50 dark:bg-red-950/20", accentBg: "bg-red-400 dark:bg-red-500" } },
  flowScreen:    { label: "Screen",   dashed: false, zIndex: 10, theme: { badge: "bg-emerald-100 dark:bg-emerald-900/40", badgeText: "text-emerald-700 dark:text-emerald-300", accent: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-400 dark:border-emerald-500", light: "bg-emerald-50/50 dark:bg-emerald-950/20", accentBg: "bg-emerald-400 dark:bg-emerald-500" } },
  flowSwimlane:  { label: "Swimlane", dashed: true,  zIndex: 1,  theme: { badge: "bg-gray-200 dark:bg-gray-700", badgeText: "text-gray-600 dark:text-gray-300", accent: "text-gray-600 dark:text-gray-400", border: "border-gray-300 dark:border-gray-600", light: "bg-gray-50 dark:bg-gray-900/30", accentBg: "bg-gray-400 dark:bg-gray-500" } },
  cloudCompute:  { label: "Compute",  dashed: false, zIndex: 10, theme: { badge: "bg-blue-100 dark:bg-blue-900/40", badgeText: "text-blue-700 dark:text-blue-300", accent: "text-blue-600 dark:text-blue-400", border: "border-blue-400 dark:border-blue-500", light: "bg-blue-50/50 dark:bg-blue-950/20", accentBg: "bg-blue-400 dark:bg-blue-500" } },
  cloudDatabase: { label: "Database", dashed: false, zIndex: 10, theme: { badge: "bg-cyan-100 dark:bg-cyan-900/40", badgeText: "text-cyan-700 dark:text-cyan-300", accent: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-400 dark:border-cyan-500", light: "bg-cyan-50/50 dark:bg-cyan-950/20", accentBg: "bg-cyan-400 dark:bg-cyan-500" } },
  cloudStorage:  { label: "Storage",  dashed: false, zIndex: 10, theme: { badge: "bg-violet-100 dark:bg-violet-900/40", badgeText: "text-violet-700 dark:text-violet-300", accent: "text-violet-600 dark:text-violet-400", border: "border-violet-400 dark:border-violet-500", light: "bg-violet-50/50 dark:bg-violet-950/20", accentBg: "bg-violet-400 dark:bg-violet-500" } },
  cloudNetwork:  { label: "Network",  dashed: false, zIndex: 10, theme: { badge: "bg-teal-100 dark:bg-teal-900/40", badgeText: "text-teal-700 dark:text-teal-300", accent: "text-teal-600 dark:text-teal-400", border: "border-teal-400 dark:border-teal-500", light: "bg-teal-50/50 dark:bg-teal-950/20", accentBg: "bg-teal-400 dark:bg-teal-500" } },
  cloudMessaging:{ label: "Messaging",dashed: false, zIndex: 10, theme: { badge: "bg-orange-100 dark:bg-orange-900/40", badgeText: "text-orange-700 dark:text-orange-300", accent: "text-orange-600 dark:text-orange-400", border: "border-orange-400 dark:border-orange-500", light: "bg-orange-50/50 dark:bg-orange-950/20", accentBg: "bg-orange-400 dark:bg-orange-500" } },
  cloudSecurity: { label: "Security", dashed: false, zIndex: 10, theme: { badge: "bg-slate-200 dark:bg-slate-700", badgeText: "text-slate-600 dark:text-slate-300", accent: "text-slate-600 dark:text-slate-400", border: "border-slate-400 dark:border-slate-500", light: "bg-slate-50 dark:bg-slate-950/20", accentBg: "bg-slate-400 dark:bg-slate-500" } },
  cloudAnalytics:{ label: "Analytics",dashed: false, zIndex: 10, theme: { badge: "bg-pink-100 dark:bg-pink-900/40", badgeText: "text-pink-700 dark:text-pink-300", accent: "text-pink-600 dark:text-pink-400", border: "border-pink-400 dark:border-pink-500", light: "bg-pink-50/50 dark:bg-pink-950/20", accentBg: "bg-pink-400 dark:bg-pink-500" } },
  cloudBoundary: { label: "Boundary", dashed: true,  zIndex: 0,  theme: { badge: "bg-gray-200 dark:bg-gray-700", badgeText: "text-gray-500 dark:text-gray-400", accent: "text-gray-500 dark:text-gray-400", border: "border-gray-300 dark:border-gray-600", light: "bg-gray-50 dark:bg-gray-900/20", accentBg: "bg-gray-300 dark:bg-gray-600" } },
}

const DEFAULT_NODE_CONFIG: NodeTypeConfig = {
  label: "Node", dashed: false, zIndex: 10,
  theme: { badge: "bg-gray-100 dark:bg-gray-800", badgeText: "text-gray-600 dark:text-gray-300", accent: "text-gray-600 dark:text-gray-400", border: "border-gray-300 dark:border-gray-600", light: "bg-gray-50 dark:bg-gray-900/10", accentBg: "bg-gray-400 dark:bg-gray-500" },
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
// Dynamic handle position — derives correct edge from layout direction
// ============================================================================

/**
 * Given the current layout direction and whether this handle is a source or
 * target, return the correct React Flow Position enum value.
 *
 * Layout flow:  TB = top→bottom,  LR = left→right,  BT = bottom→top,  RL = right→left
 * Source handle = the "exit" side of the node (where the arrow leaves)
 * Target handle = the "entry" side of the node (where the arrow arrives)
 */
function resolveHandlePosition(layoutDirection: string | undefined, handleType: "source" | "target"): Position {
  const dir = layoutDirection?.toUpperCase() || "LR"

  if (dir === "TB") return handleType === "source" ? Position.Bottom : Position.Top
  if (dir === "BT") return handleType === "source" ? Position.Top   : Position.Bottom
  if (dir === "RL") return handleType === "source" ? Position.Left  : Position.Right
  // Default: LR
  return handleType === "source" ? Position.Right : Position.Left
}

/**
 * For a given layout direction, return the style offset for placing a handle
 * at the correct cardinal edge center. We override x/y from the backend data
 * because the backend data may be stale (set during a different direction).
 */
function handleStyle(position: Position): React.CSSProperties {
  // Centers the handle on the edge it belongs to.
  // React Flow will further offset it by its own logic, we just need the
  // percentage-based position to put it at the midpoint of the edge.
  switch (position) {
    case Position.Top:    return { left: "50%", top: 0,    transform: "translate(-50%, -50%)" }
    case Position.Bottom: return { left: "50%", bottom: 0, top: "auto", transform: "translate(-50%, 50%)" }
    case Position.Left:   return { top: "50%",  left: 0,   transform: "translate(-50%, -50%)" }
    case Position.Right:  return { top: "50%",  right: 0,  left: "auto", transform: "translate(50%, -50%)" }
  }
}

// ============================================================================
// Handle component — direction-aware, invisible at rest, visible on hover
// ============================================================================

function NodeHandle({ h, layoutDirection }: { h: HandleConfig; layoutDirection?: string }) {
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
        // Invisible at rest; parent has `group` class so hover reveals them
        opacity: 0,
        transition: "opacity 0.15s ease, transform 0.15s ease",
      }}
      className="!border-border !bg-background !z-10 group-hover:!opacity-100"
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
  const layoutDirection = data.layoutDirection

  // Determine which side the accent stripe should be on:
  // In LR mode, nodes flow left→right so the stripe stays on the left.
  // In RL mode, nodes flow right→left so the stripe should be on the right.
  // In TB/BT modes, the stripe stays on the left as a visual marker.
  const stripeOnRight = layoutDirection?.toUpperCase() === "RL"

  return (
    <div
      className={cn(
        // `group` enables the CSS group-hover to show handles on hover
        "group relative rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow",
        cfg.dashed ? "border-dashed" : "border-solid",
        "min-w-[220px] max-w-[300px]",
        selected && "ring-2 ring-ring shadow-md",
        !selected && "hover:shadow-md hover:shadow-black/5",
        theme.border,
      )}
    >
      {/* Direction-aware handles */}
      {handles.map((h) => (
        <NodeHandle key={h.id} h={h} layoutDirection={layoutDirection} />
      ))}

      {/* Accent stripe — left or right depending on flow direction */}
      <div
        className={cn(
          "absolute top-0 bottom-0 w-1 rounded-l-xl",
          stripeOnRight ? "right-0 rounded-l-none rounded-r-xl" : "left-0",
          theme.accentBg,
        )}
      />

      {/* Content — padded away from the stripe */}
      <div className={cn("p-3", stripeOnRight ? "pr-4" : "pl-4")}>
        {/* Header row: type badge + status dot */}
        <div className="flex items-center justify-between mb-2">
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-widest",
            theme.badge, theme.badgeText
          )}>
            {data.icon && <span className="text-xs">{data.icon}</span>}
            {cfg.label}
            {/* Type qualifier (e.g. "Container", "Actor") */}
            {data.statusState && (
              <span className="text-[9px] font-medium opacity-70 normal-case tracking-normal capitalize">
                {nodeType.replace(/^(c4|flow|cloud)/, " ").trim()}
              </span>
            )}
          </span>
          {data.statusState && (
            <span className={cn(
              "w-2 h-2 rounded-full flex-shrink-0",
              STATUS_CLASSES[data.statusState] || STATUS_CLASSES.normal
            )} />
          )}
        </div>

        {/* Primary label + subtitle */}
        <div className="mb-2">
          <h3 className={cn("text-sm font-semibold leading-tight", theme.accent)}>
            {data.label}
          </h3>
          {data.subtitle && (
            <p className="text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">
              {data.subtitle}
            </p>
          )}
        </div>

        {/* Tech stack tags */}
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
// Container Node — renders all dedicated group/container types
// Each variant gets a distinct visual treatment so hierarchy is immediately
// readable at a glance:
//   deploymentGroup — large dashed blue border, prominent zone label
//   serviceGroup    — solid violet border, cluster label
//   domainGroup     — dashed amber border, domain label
//   dataGroup       — solid cyan border, data tier label
//   networkGroup    — dashed teal border, network zone label
//   c4Boundary / cloudBoundary — C4 notation fallbacks
// ============================================================================

const GROUP_LABEL_CONFIG: Record<string, { icon: string; size: string }> = {
  deploymentGroup: { icon: "🌐", size: "text-[11px]" },
  serviceGroup:    { icon: "⚙️", size: "text-[10px]" },
  domainGroup:     { icon: "🔷", size: "text-[10px]" },
  dataGroup:       { icon: "🗄️", size: "text-[10px]" },
  networkGroup:    { icon: "🔗", size: "text-[10px]" },
  c4Boundary:      { icon: "⬡", size: "text-[10px]" },
  cloudBoundary:   { icon: "☁️", size: "text-[10px]" },
}

function ContainerNode({ data, selected, nodeType }: { data: NodeData; selected?: boolean; nodeType: string }) {
  const cfg = getNodeConfig(nodeType)
  const { theme } = cfg
  const meta = GROUP_LABEL_CONFIG[nodeType]

  // Top-level deployment zones get more visual weight
  const isTopLevel = nodeType === "deploymentGroup" || nodeType === "networkGroup"

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 transition-shadow",
        isTopLevel ? "min-w-[360px] min-h-[200px]" : "min-w-[240px] min-h-[140px]",
        cfg.dashed ? "border-dashed" : "border-solid",
        selected && "ring-2 ring-ring shadow-md",
        theme.border,
        theme.light,
      )}
    >
      {/* Header bar — label pinned to top edge */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 flex items-center gap-1.5 px-3 py-1.5",
          "border-b",
          cfg.dashed ? "border-dashed" : "border-solid",
          theme.border,
        )}
      >
        {meta && <span className="text-sm leading-none">{meta.icon}</span>}
        <span className={cn("font-bold uppercase tracking-widest", meta?.size ?? "text-[10px]", theme.accent)}>
          {data.label}
        </span>
        {data.subtitle && (
          <span className="text-[10px] text-muted-foreground font-normal normal-case tracking-normal ml-1">
            {data.subtitle}
          </span>
        )}
        {/* Type badge pinned to far right */}
        <span className={cn(
          "ml-auto px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider",
          theme.badge, theme.badgeText
        )}>
          {cfg.label}
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// Group Node — container for children (legacy 'group' type)
// ============================================================================

function GroupNode({ data, selected, nodeType }: { data: NodeData; selected?: boolean; nodeType: string }) {
  const cfg = getNodeConfig(nodeType)
  const { theme } = cfg

  return (
    <div
      className={cn(
        "relative min-w-[300px] min-h-[160px] rounded-xl border-2 border-dashed transition-shadow",
        selected && "ring-2 ring-ring shadow-md",
        theme.border,
        theme.light,
      )}
    >
      <div className={cn("px-3 py-1.5 border-b border-dashed flex items-center gap-2", theme.border)}>
        <span className={cn("text-[10px] font-semibold uppercase tracking-widest", theme.badgeText)}>
          {cfg.label}
        </span>
        <span className="text-xs text-muted-foreground font-medium truncate">{data.label}</span>
      </div>
      {data.title && (
        <div className="px-3 py-1.5 border-b border-dashed">
          <h4 className={cn("text-sm font-semibold", theme.accent)}>{data.title}</h4>
        </div>
      )}
      {data.description && (
        <div className="px-3 py-1.5">
          <p className="text-xs text-muted-foreground">{data.description}</p>
        </div>
      )}
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

const CONTAINER_TYPES = new Set([
  "deploymentGroup", "serviceGroup", "domainGroup", "dataGroup", "networkGroup",
  "c4Boundary", "cloudBoundary",
])

function DiagramNode(props: NodeProps) {
  const { data, selected, type } = props
  const isContainer = CONTAINER_TYPES.has(type || "")
  const isSwimlane = type === "flowSwimlane"
  const isLegacyGroup = type === "group"

  if (isContainer) return <ContainerNode data={data as NodeData} selected={selected} nodeType={type || "group"} />
  if (isSwimlane)  return <SwimlaneNode data={data as NodeData} selected={selected} />
  if (isLegacyGroup) return <GroupNode data={data as NodeData} selected={selected} nodeType={type || "group"} />

  return <CardNode data={data as NodeData} selected={selected} nodeType={type || "c4Container"} />
}

export const nodeTypes = {
  // Group / Container types
  deploymentGroup: DiagramNode,
  serviceGroup: DiagramNode,
  domainGroup: DiagramNode,
  dataGroup: DiagramNode,
  networkGroup: DiagramNode,
  group: DiagramNode,
  // C4 types
  c4Actor: DiagramNode,
  c4System: DiagramNode,
  c4Container: DiagramNode,
  c4Component: DiagramNode,
  c4Boundary: DiagramNode,
  // Flow types
  flowAction: DiagramNode,
  flowDecision: DiagramNode,
  flowScreen: DiagramNode,
  flowSwimlane: DiagramNode,
  // Cloud types
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
// Custom edge — renders path + label pill + protocol sub-label
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
  if (!edgeData) return { stroke: "#94a3b8", strokeWidth: 1.5 }
  const style: React.CSSProperties = { strokeWidth: 1.5 }

  if (edgeData.logicVariant && edgeData.logicVariant !== "standard_flow") {
    style.strokeDasharray = "6,4"
    style.stroke = "#818cf8" // indigo for conditional paths
  } else {
    style.stroke = "#94a3b8" // slate-400 — subtle neutral
  }

  // Protocol-specific overrides
  if (edgeData.protocol === "gRPC" || edgeData.protocol === "WebSocket") {
    style.stroke = "#a78bfa" // violet
  } else if (edgeData.protocol === "AMQP" || edgeData.protocol === "Kafka") {
    style.stroke = "#fb923c" // orange for message queues
  }

  return style
}

export function CustomEdge(props: EdgeProps) {
  const {
    id, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
    label, data, selected, markerEnd, markerStart, animated, type: edgeType,
  } = props
  const edgeData = data as EdgeData | undefined
  const pathType = edgeType || "default"

  const [edgePath, labelX, labelY] = getEdgePath(pathType, {
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  // Use the path midpoint provided by the path helper (more accurate than getEdgeCenter)
  // and offset the protocol label below the main label
  const hasLabel = !!label
  const hasProtocol = !!(edgeData?.protocol && edgeData.protocol !== "none")
  const labelStr = label as string | undefined
  const protocolStr = edgeData?.protocol

  // Estimate label pill width based on text length
  const labelW = Math.max(40, (labelStr?.length ?? 0) * 6.5 + 16)
  const protocolW = Math.max(32, (protocolStr?.length ?? 0) * 5.5 + 12)

  return (
    <g>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...edgePathStyle(edgeData),
          animation: animated ? "dashdraw 0.5s linear infinite" : undefined,
        }}
        markerEnd={markerEnd}
        markerStart={markerStart}
        className={cn(selected && "!stroke-foreground/70")}
      />

      {/* Main label pill */}
      {hasLabel && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect
            x={-labelW / 2}
            y={-11}
            width={labelW}
            height={20}
            rx={5}
            className="fill-background stroke-border"
            strokeWidth={0.75}
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.08))" }}
          />
          <text
            x={0}
            y={3}
            textAnchor="middle"
            className="fill-foreground/80"
            style={{ fontSize: "10px", fontWeight: 600, fontFamily: "inherit" }}
          >
            {labelStr}
          </text>
        </g>
      )}

      {/* Protocol sub-label — appears below the main label (or at midpoint if no label) */}
      {hasProtocol && (
        <g transform={`translate(${labelX}, ${labelY + (hasLabel ? 17 : 0)})`}>
          <rect
            x={-protocolW / 2}
            y={-8}
            width={protocolW}
            height={14}
            rx={3}
            className="fill-muted/80 stroke-border/40"
            strokeWidth={0.5}
          />
          <text
            x={0}
            y={3}
            textAnchor="middle"
            className="fill-muted-foreground/70"
            style={{ fontSize: "9px", fontFamily: "monospace" }}
          >
            {protocolStr}
          </text>
        </g>
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
      to   { stroke-dashoffset: 0; }
    }
    /* Ensure group-hover works for React Flow node wrappers */
    .react-flow__node:hover .group-hover\\:opacity-100 {
      opacity: 1 !important;
    }
  `
  document.head.appendChild(style)
}
