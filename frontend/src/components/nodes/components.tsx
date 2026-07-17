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
// Node Type Config
// ============================================================================

interface NodeTheme {
  badge: string
  badgeText: string
  accent: string
  border: string
  light: string
  accentBg: string
}

interface NodeTypeConfig {
  label: string
  dashed: boolean
  zIndex: number
  theme: NodeTheme
}

const NODE_TYPE_CONFIG: Record<string, NodeTypeConfig> = {
  deploymentGroup: { label: "Zone",    dashed: true,  zIndex: 0,  theme: { badge: "bg-blue-100 dark:bg-blue-900/40",   badgeText: "text-blue-700 dark:text-blue-300",   accent: "text-blue-600 dark:text-blue-400",   border: "border-blue-300 dark:border-blue-600",   light: "bg-blue-50/20 dark:bg-blue-950/10",   accentBg: "bg-blue-500"   } },
  serviceGroup:    { label: "Cluster", dashed: false, zIndex: 0,  theme: { badge: "bg-violet-100 dark:bg-violet-900/40", badgeText: "text-violet-700 dark:text-violet-300", accent: "text-violet-600 dark:text-violet-400", border: "border-violet-300 dark:border-violet-600/70", light: "bg-violet-50/20 dark:bg-violet-950/10", accentBg: "bg-violet-500" } },
  domainGroup:     { label: "Domain",  dashed: true,  zIndex: 0,  theme: { badge: "bg-amber-100 dark:bg-amber-900/40",  badgeText: "text-amber-700 dark:text-amber-300",  accent: "text-amber-600 dark:text-amber-400",  border: "border-amber-300 dark:border-amber-600/70",  light: "bg-amber-50/20 dark:bg-amber-950/10",  accentBg: "bg-amber-500"  } },
  dataGroup:       { label: "Data",    dashed: false, zIndex: 0,  theme: { badge: "bg-cyan-100 dark:bg-cyan-900/40",   badgeText: "text-cyan-700 dark:text-cyan-300",   accent: "text-cyan-600 dark:text-cyan-400",   border: "border-cyan-300 dark:border-cyan-600/70",   light: "bg-cyan-50/20 dark:bg-cyan-950/10",   accentBg: "bg-cyan-500"   } },
  networkGroup:    { label: "Network", dashed: true,  zIndex: 0,  theme: { badge: "bg-teal-100 dark:bg-teal-900/40",   badgeText: "text-teal-700 dark:text-teal-300",   accent: "text-teal-600 dark:text-teal-400",   border: "border-teal-300 dark:border-teal-600/70",   light: "bg-teal-50/20 dark:bg-teal-950/10",   accentBg: "bg-teal-500"   } },
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
      accentBg: "bg-gray-400",
    },
  },
  c4Actor:       { label: "Actor",    dashed: false, zIndex: 20, theme: { badge: "bg-indigo-100 dark:bg-indigo-900/40", badgeText: "text-indigo-700 dark:text-indigo-300", accent: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-400 dark:border-indigo-500", light: "bg-indigo-50/50 dark:bg-indigo-950/20", accentBg: "bg-indigo-500" } },
  c4System:      { label: "System",   dashed: false, zIndex: 10, theme: { badge: "bg-indigo-100 dark:bg-indigo-900/40", badgeText: "text-indigo-700 dark:text-indigo-300", accent: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-400 dark:border-indigo-500", light: "bg-indigo-50/50 dark:bg-indigo-950/20", accentBg: "bg-indigo-500" } },
  c4Container:   { label: "Container",dashed: false, zIndex: 10, theme: { badge: "bg-violet-100 dark:bg-violet-900/40", badgeText: "text-violet-700 dark:text-violet-300", accent: "text-violet-600 dark:text-violet-400", border: "border-violet-400 dark:border-violet-500", light: "bg-violet-50/50 dark:bg-violet-950/20", accentBg: "bg-violet-500" } },
  c4Component:   { label: "Component",dashed: false, zIndex: 10, theme: { badge: "bg-purple-100 dark:bg-purple-900/40", badgeText: "text-purple-700 dark:text-purple-300", accent: "text-purple-600 dark:text-purple-400", border: "border-purple-400 dark:border-purple-500", light: "bg-purple-50/50 dark:bg-purple-950/20", accentBg: "bg-violet-500" } },
  c4Boundary:    { label: "Boundary", dashed: true,  zIndex: 0,  theme: { badge: "bg-fuchsia-100 dark:bg-fuchsia-900/40", badgeText: "text-fuchsia-700 dark:text-fuchsia-300", accent: "text-fuchsia-600 dark:text-fuchsia-400", border: "border-fuchsia-300 dark:border-fuchsia-500/60", light: "bg-fuchsia-50/40 dark:bg-fuchsia-950/10", accentBg: "bg-fuchsia-500" } },
  flowAction:    { label: "Action",   dashed: false, zIndex: 10, theme: { badge: "bg-amber-100 dark:bg-amber-900/40", badgeText: "text-amber-700 dark:text-amber-300", accent: "text-amber-600 dark:text-amber-400", border: "border-amber-400 dark:border-amber-500", light: "bg-amber-50/50 dark:bg-amber-950/20", accentBg: "bg-amber-500" } },
  flowDecision:  { label: "Decision", dashed: false, zIndex: 10, theme: { badge: "bg-red-100 dark:bg-red-900/40", badgeText: "text-red-700 dark:text-red-300", accent: "text-red-600 dark:text-red-400", border: "border-red-400 dark:border-red-500", light: "bg-red-50/50 dark:bg-red-950/20", accentBg: "bg-red-500" } },
  flowScreen:    { label: "Screen",   dashed: false, zIndex: 10, theme: { badge: "bg-emerald-100 dark:bg-emerald-900/40", badgeText: "text-emerald-700 dark:text-emerald-300", accent: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-400 dark:border-emerald-500", light: "bg-emerald-50/50 dark:bg-emerald-950/20", accentBg: "bg-emerald-500" } },
  flowSwimlane:  { label: "Swimlane", dashed: true,  zIndex: 1,  theme: { badge: "bg-gray-200 dark:bg-gray-700", badgeText: "text-gray-600 dark:text-gray-300", accent: "text-gray-600 dark:text-gray-400", border: "border-gray-300 dark:border-gray-600", light: "bg-gray-50 dark:bg-gray-900/30", accentBg: "bg-gray-500" } },
  cloudCompute:  { label: "Compute",  dashed: false, zIndex: 10, theme: { badge: "bg-blue-100 dark:bg-blue-900/40", badgeText: "text-blue-700 dark:text-blue-300", accent: "text-blue-600 dark:text-blue-400", border: "border-blue-400 dark:border-blue-500", light: "bg-blue-50/50 dark:bg-blue-950/20", accentBg: "bg-blue-500" } },
  cloudDatabase: { label: "Database", dashed: false, zIndex: 10, theme: { badge: "bg-cyan-100 dark:bg-cyan-900/40", badgeText: "text-cyan-700 dark:text-cyan-300", accent: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-400 dark:border-cyan-500", light: "bg-cyan-50/50 dark:bg-cyan-950/20", accentBg: "bg-cyan-500" } },
  cloudStorage:  { label: "Storage",  dashed: false, zIndex: 10, theme: { badge: "bg-violet-100 dark:bg-violet-900/40", badgeText: "text-violet-700 dark:text-violet-300", accent: "text-violet-600 dark:text-violet-400", border: "border-violet-400 dark:border-violet-500", light: "bg-violet-50/50 dark:bg-violet-950/20", accentBg: "bg-violet-500" } },
  cloudNetwork:  { label: "Network",  dashed: false, zIndex: 10, theme: { badge: "bg-teal-100 dark:bg-teal-900/40", badgeText: "text-teal-700 dark:text-teal-300", accent: "text-teal-600 dark:text-teal-400", border: "border-teal-400 dark:border-teal-500", light: "bg-teal-50/50 dark:bg-teal-950/20", accentBg: "bg-teal-500" } },
  cloudMessaging:{ label: "Messaging",dashed: false, zIndex: 10, theme: { badge: "bg-orange-100 dark:bg-orange-900/40", badgeText: "text-orange-700 dark:text-orange-300", accent: "text-orange-600 dark:text-orange-400", border: "border-orange-400 dark:border-orange-500", light: "bg-orange-50/50 dark:bg-orange-950/20", accentBg: "bg-orange-500" } },
  cloudSecurity: { label: "Security", dashed: false, zIndex: 10, theme: { badge: "bg-slate-200 dark:bg-slate-700", badgeText: "text-slate-600 dark:text-slate-300", accent: "text-slate-600 dark:text-slate-400", border: "border-slate-400 dark:border-slate-500", light: "bg-slate-50 dark:bg-slate-950/20", accentBg: "bg-slate-500" } },
  cloudAnalytics:{ label: "Analytics",dashed: false, zIndex: 10, theme: { badge: "bg-pink-100 dark:bg-pink-900/40", badgeText: "text-pink-700 dark:text-pink-300", accent: "text-pink-600 dark:text-pink-400", border: "border-pink-400 dark:border-pink-500", light: "bg-pink-50/50 dark:bg-pink-950/20", accentBg: "bg-pink-500" } },
  cloudBoundary: { label: "Boundary", dashed: true,  zIndex: 0,  theme: { badge: "bg-gray-200 dark:bg-gray-700", badgeText: "text-gray-500 dark:text-gray-400", accent: "text-gray-500 dark:text-gray-400", border: "border-gray-300 dark:border-gray-600", light: "bg-gray-50 dark:bg-gray-900/20", accentBg: "bg-gray-500" } },
}

const DEFAULT_NODE_CONFIG: NodeTypeConfig = {
  label: "Node", dashed: false, zIndex: 10,
  theme: { badge: "bg-gray-100 dark:bg-gray-800", badgeText: "text-gray-600 dark:text-gray-300", accent: "text-gray-600 dark:text-gray-400", border: "border-gray-300 dark:border-gray-600", light: "bg-gray-50 dark:bg-gray-900/10", accentBg: "bg-gray-500" },
}

function getNodeConfig(nodeType: string): NodeTypeConfig {
  return NODE_TYPE_CONFIG[nodeType] || DEFAULT_NODE_CONFIG
}

const STATUS_DOTS: Record<string, string> = {
  normal: "bg-green-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  proposed: "bg-blue-500",
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
        opacity: 0,
        transition: "opacity 0.15s ease",
      }}
      className="!border-border !bg-background !z-10 group-hover:!opacity-100"
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
// Card Node — Swiss minimalistic with sharp lines
// ============================================================================

function CardNode({ data, selected, nodeType }: { data: NodeData; selected?: boolean; nodeType: string }) {
  const cfg = getNodeConfig(nodeType)
  const { theme } = cfg
  const handles = (data.handles || []) as HandleConfig[]
  const layoutDirection = data.layoutDirection
  const IconComponent = data.icon ? ICON_MAP[data.icon] : null

  const hasTech = [
    data.languageRuntime, data.frameworkLibrary, data.databaseEngine,
    data.cloudServiceName, data.cloudTier, ...(data.metadataTags || []),
  ].some(v => v && v !== "none")

  const hasDbInfo = !!data.tableName

  return (
    <div
      className={cn(
        "group relative border bg-background text-foreground transition-all duration-150",
        "rounded-sm",
        cfg.dashed ? "border-dashed" : "border-solid",
        "min-w-[240px] max-w-[340px]",
        selected ? "ring-1 ring-ring" : "hover:shadow-sm",
        theme.border,
      )}
    >
      {handles.map((h) => (
        <NodeHandle key={h.id} h={h} layoutDirection={layoutDirection} />
      ))}

      {/* Swiss accent bar — 4px solid top bar */}
      <div className={cn("h-1", theme.accentBg)} />

      <div className="p-3">
        {/* Header: Icon + Type label + Status dot */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {IconComponent && (
              <IconComponent className={cn("w-3.5 h-3.5 stroke-[2]", theme.accent)} />
            )}
            <span className={cn(
              "inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider font-medium leading-none",
              "rounded-sm",
              theme.badge, theme.badgeText,
            )}>
              {cfg.label}
            </span>
          </div>
          {data.statusState && (
            <span className={cn("w-2 h-2 rounded-sm shrink-0", STATUS_DOTS[data.statusState])} />
          )}
        </div>

        {/* Label + Subtitle */}
        <div className="mb-1.5">
          <h3 className="text-sm font-semibold text-foreground leading-snug">
            {data.label}
          </h3>
          {data.subtitle && (
            <p className="text-xs text-muted-foreground leading-normal mt-0.5 line-clamp-2">
              {data.subtitle}
            </p>
          )}
        </div>

        {/* Purpose — clean text, no decoration */}
        {data.purpose && (
          <p className="text-[11px] text-muted-foreground/60 leading-relaxed line-clamp-2 mb-1">
            {data.purpose}
          </p>
        )}

        {/* Tech stack */}
        {hasTech && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border">
            {data.languageRuntime !== "none" && (
              <span className="px-1.5 py-[2px] text-[9px] font-mono font-medium rounded-sm border border-border text-muted-foreground">
                {data.languageRuntime}
              </span>
            )}
            {data.frameworkLibrary !== "none" && (
              <span className="px-1.5 py-[2px] text-[9px] font-mono font-medium rounded-sm border border-border text-muted-foreground">
                {data.frameworkLibrary}
              </span>
            )}
            {data.databaseEngine !== "none" && (
              <span className="px-1.5 py-[2px] text-[9px] font-mono font-medium rounded-sm border border-border bg-muted text-muted-foreground">
                {data.databaseEngine}
              </span>
            )}
            {data.cloudServiceName !== "none" && (
              <span className="px-1.5 py-[2px] text-[9px] font-mono font-medium rounded-sm border border-border text-muted-foreground">
                {data.cloudServiceName}
              </span>
            )}
            {data.cloudTier !== "none" && (
              <span className="px-1.5 py-[2px] text-[9px] font-mono font-medium rounded-sm text-muted-foreground">
                {data.cloudTier}
              </span>
            )}
            {data.metadataTags && data.metadataTags.slice(0, 2).map((tag, i) => (
              <span key={i} className="px-1.5 py-[2px] text-[9px] font-mono font-medium rounded-sm border border-border text-muted-foreground">
                {tag}
              </span>
            ))}
            {data.metadataTags && data.metadataTags.length > 2 && (
              <span className="px-1.5 py-[2px] text-[9px] font-mono font-medium rounded-sm text-muted-foreground">
                +{data.metadataTags.length - 2}
              </span>
            )}
          </div>
        )}

        {/* DB Schema */}
        {hasDbInfo && (
          <div className={cn(
            "mt-2 pt-2 text-[10px] font-mono text-muted-foreground truncate",
            hasTech && "border-t border-border",
          )}>
            <span className="font-semibold text-foreground/70">{data.tableName}</span>
            {data.columns && data.columns.length > 0 && (
              <span className="text-muted-foreground/50"> ({data.columns.join(", ")})</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Container Node — Swiss minimalistic groups
// ============================================================================

function ContainerNode({ data, selected, nodeType }: { data: NodeData; selected?: boolean; nodeType: string }) {
  const cfg = getNodeConfig(nodeType)
  const { theme } = cfg
  const GroupIcon = GROUP_ICON_MAP[nodeType] || FolderClosed
  const handles = (data.handles || []) as HandleConfig[]
  const layoutDirection = data.layoutDirection

  return (
    <div
      className={cn(
        "group w-full h-full rounded-sm border transition-shadow relative",
        cfg.dashed ? "border-dashed" : "border-solid",
        theme.border,
        theme.light,
        selected && "ring-1 ring-ring",
      )}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={280}
        minHeight={160}
        lineClassName="!border-foreground/30"
        handleClassName="!bg-foreground/50 !w-2.5 !h-2.5 !border-0"
      />
      {handles.map((h) => (
        <NodeHandle key={h.id} h={h} layoutDirection={layoutDirection} />
      ))}

      {/* Accent bar */}
      <div className={cn("h-1 rounded-t-sm", theme.accentBg)} />

      {/* Drag handle header */}
      <div
        className={cn(
          "rf-group-drag-handle",
          "flex items-center gap-2 px-3 py-1.5",
          "border-b cursor-grab active:cursor-grabbing select-none",
          theme.border,
        )}
      >
        <GroupIcon className={cn("w-3.5 h-3.5 stroke-[2] shrink-0", theme.accent)} />
        <span className="text-xs font-semibold text-foreground/80 truncate">
          {data.label}
        </span>
        {data.subtitle && (
          <span className="text-[10px] text-muted-foreground/50 truncate hidden sm:inline">
            — {data.subtitle}
          </span>
        )}
        <span className={cn(
          "ml-auto px-1.5 py-[2px] text-[8px] font-mono uppercase tracking-wider shrink-0 rounded-sm",
          theme.badge, theme.badgeText,
        )}>
          {cfg.label}
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// Group Node — legacy generic group
// ============================================================================

function GroupNode({ data, selected, nodeType }: { data: NodeData; selected?: boolean; nodeType: string }) {
  const cfg = getNodeConfig(nodeType)
  const { theme } = cfg

  return (
    <div
      className={cn(
        "relative w-full h-full rounded-sm border-2 border-dashed transition-shadow",
        selected && "ring-1 ring-ring",
        theme.border,
        theme.light,
      )}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={240}
        minHeight={120}
        lineClassName="!border-foreground/30"
        handleClassName="!bg-foreground/50 !w-2.5 !h-2.5 !border-0"
      />
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 border-b border-dashed",
        theme.border,
      )}>
        <span className={cn(
          "text-[8px] font-mono uppercase tracking-widest font-semibold leading-none",
          theme.badgeText,
        )}>
          {cfg.label}
        </span>
        <span className="text-xs font-medium text-foreground/70 truncate">{data.label}</span>
      </div>
      {data.title && (
        <div className="px-3 py-1.5 border-b border-dashed" style={{ borderColor: "inherit" }}>
          <h4 className={cn("text-sm font-semibold", theme.accent)}>{data.title}</h4>
        </div>
      )}
      {data.description && (
        <div className="px-3 py-1.5">
          <p className="text-xs text-muted-foreground">{data.description}</p>
        </div>
      )}
      {data.purpose && !data.title && !data.description && (
        <div className="px-3 py-2">
          <p className="text-[11px] text-muted-foreground/60">{data.purpose}</p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Swimlane Node
// ============================================================================

function SwimlaneNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  const isHorizontal = data.layoutOrientation !== "vertical"

  return (
    <div
      className={cn(
        "relative flex rounded-sm border border-border bg-muted/20 transition-shadow min-h-[80px]",
        isHorizontal ? "flex-row" : "flex-col",
        selected && "ring-1 ring-ring",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center font-semibold text-muted-foreground",
          isHorizontal
            ? "w-7 min-h-full border-r border-border text-[9px] [writing-mode:vertical-rl] tracking-widest uppercase"
            : "h-6 w-full border-b border-border text-[9px] tracking-widest uppercase",
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

function DiagramNode(props: NodeProps) {
  const { data, selected, type } = props
  const isContainer = CONTAINER_TYPES.has(type || "")
  const isSwimlane = type === "flowSwimlane"
  const isLegacyGroup = type === "group"

  const nodeData = data as any as NodeData

  if (isContainer) return <ContainerNode data={nodeData} selected={selected} nodeType={type || "group"} />
  if (isSwimlane)  return <SwimlaneNode data={nodeData} selected={selected} />
  if (isLegacyGroup) return <GroupNode data={nodeData} selected={selected} nodeType={type || "group"} />

  return <CardNode data={nodeData} selected={selected} nodeType={type || "c4Container"} />
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
// Custom Edge
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
    style.stroke = "#818cf8"
  } else {
    style.stroke = "#94a3b8"
  }

  if (edgeData.protocol === "gRPC" || edgeData.protocol === "WebSocket") {
    style.stroke = "#a78bfa"
  } else if (edgeData.protocol === "AMQP" || edgeData.protocol === "Kafka") {
    style.stroke = "#fb923c"
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

  const hasLabel = !!label
  const hasProtocol = !!(edgeData?.protocol && edgeData.protocol !== "none")
  const labelStr = label as string | undefined
  const protocolStr = edgeData?.protocol

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

      {hasLabel && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect
            x={-labelW / 2}
            y={-10}
            width={labelW}
            height={18}
            rx={3}
            className="fill-background stroke-border"
            strokeWidth={0.75}
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

      {hasProtocol && (
        <g transform={`translate(${labelX}, ${labelY + (hasLabel ? 16 : 0)})`}>
          <rect
            x={-protocolW / 2}
            y={-7}
            width={protocolW}
            height={13}
            rx={2}
            className="fill-muted/80 stroke-border/40"
            strokeWidth={0.5}
          />
          <text
            x={0}
            y={2.5}
            textAnchor="middle"
            className="fill-muted-foreground/70"
            style={{ fontSize: "8px", fontFamily: "monospace" }}
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
