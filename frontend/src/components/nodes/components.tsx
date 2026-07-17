import { Handle, Position, BaseEdge, getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps } from "@xyflow/react"
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
  borderStyle?: string
  handles?: HandleConfig[]
  layoutOrientation?: string
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
// Color system — one accent per node type, used via Tailwind color classes
// ============================================================================

interface NodeTheme {
  badge: string       // badge bg
  badgeText: string   // badge text
  accent: string      // heading accent
  border: string      // border ring
  light: string       // light bg
}

const TYPE_THEMES: Record<string, NodeTheme> = {
  c4Actor:       { badge: "bg-indigo-100 dark:bg-indigo-900/40", badgeText: "text-indigo-700 dark:text-indigo-300", accent: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-400 dark:border-indigo-500", light: "bg-indigo-50/50 dark:bg-indigo-950/20" },
  c4System:      { badge: "bg-indigo-100 dark:bg-indigo-900/40", badgeText: "text-indigo-700 dark:text-indigo-300", accent: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-400 dark:border-indigo-500", light: "bg-indigo-50/50 dark:bg-indigo-950/20" },
  c4Container:   { badge: "bg-violet-100 dark:bg-violet-900/40", badgeText: "text-violet-700 dark:text-violet-300", accent: "text-violet-600 dark:text-violet-400", border: "border-violet-400 dark:border-violet-500", light: "bg-violet-50/50 dark:bg-violet-950/20" },
  c4Component:   { badge: "bg-purple-100 dark:bg-purple-900/40", badgeText: "text-purple-700 dark:text-purple-300", accent: "text-purple-600 dark:text-purple-400", border: "border-purple-400 dark:border-purple-500", light: "bg-purple-50/50 dark:bg-purple-950/20" },
  c4Boundary:    { badge: "bg-fuchsia-100 dark:bg-fuchsia-900/40", badgeText: "text-fuchsia-700 dark:text-fuchsia-300", accent: "text-fuchsia-600 dark:text-fuchsia-400", border: "border-fuchsia-300 dark:border-fuchsia-500/60", light: "bg-fuchsia-50/40 dark:bg-fuchsia-950/10" },
  flowAction:    { badge: "bg-amber-100 dark:bg-amber-900/40", badgeText: "text-amber-700 dark:text-amber-300", accent: "text-amber-600 dark:text-amber-400", border: "border-amber-400 dark:border-amber-500", light: "bg-amber-50/50 dark:bg-amber-950/20" },
  flowDecision:  { badge: "bg-red-100 dark:bg-red-900/40", badgeText: "text-red-700 dark:text-red-300", accent: "text-red-600 dark:text-red-400", border: "border-red-400 dark:border-red-500", light: "bg-red-50/50 dark:bg-red-950/20" },
  flowScreen:    { badge: "bg-emerald-100 dark:bg-emerald-900/40", badgeText: "text-emerald-700 dark:text-emerald-300", accent: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-400 dark:border-emerald-500", light: "bg-emerald-50/50 dark:bg-emerald-950/20" },
  flowSwimlane:  { badge: "bg-gray-200 dark:bg-gray-700", badgeText: "text-gray-600 dark:text-gray-300", accent: "text-gray-600 dark:text-gray-400", border: "border-gray-300 dark:border-gray-600", light: "bg-gray-50 dark:bg-gray-900/30" },
  cloudCompute:  { badge: "bg-blue-100 dark:bg-blue-900/40", badgeText: "text-blue-700 dark:text-blue-300", accent: "text-blue-600 dark:text-blue-400", border: "border-blue-400 dark:border-blue-500", light: "bg-blue-50/50 dark:bg-blue-950/20" },
  cloudDatabase: { badge: "bg-cyan-100 dark:bg-cyan-900/40", badgeText: "text-cyan-700 dark:text-cyan-300", accent: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-400 dark:border-cyan-500", light: "bg-cyan-50/50 dark:bg-cyan-950/20" },
  cloudStorage:  { badge: "bg-violet-100 dark:bg-violet-900/40", badgeText: "text-violet-700 dark:text-violet-300", accent: "text-violet-600 dark:text-violet-400", border: "border-violet-400 dark:border-violet-500", light: "bg-violet-50/50 dark:bg-violet-950/20" },
  cloudNetwork:  { badge: "bg-teal-100 dark:bg-teal-900/40", badgeText: "text-teal-700 dark:text-teal-300", accent: "text-teal-600 dark:text-teal-400", border: "border-teal-400 dark:border-teal-500", light: "bg-teal-50/50 dark:bg-teal-950/20" },
  cloudMessaging:{ badge: "bg-orange-100 dark:bg-orange-900/40", badgeText: "text-orange-700 dark:text-orange-300", accent: "text-orange-600 dark:text-orange-400", border: "border-orange-400 dark:border-orange-500", light: "bg-orange-50/50 dark:bg-orange-950/20" },
  cloudSecurity: { badge: "bg-slate-200 dark:bg-slate-700", badgeText: "text-slate-600 dark:text-slate-300", accent: "text-slate-600 dark:text-slate-400", border: "border-slate-400 dark:border-slate-500", light: "bg-slate-50 dark:bg-slate-950/20" },
  cloudAnalytics:{ badge: "bg-pink-100 dark:bg-pink-900/40", badgeText: "text-pink-700 dark:text-pink-300", accent: "text-pink-600 dark:text-pink-400", border: "border-pink-400 dark:border-pink-500", light: "bg-pink-50/50 dark:bg-pink-950/20" },
  cloudBoundary: { badge: "bg-gray-200 dark:bg-gray-700", badgeText: "text-gray-500 dark:text-gray-400", accent: "text-gray-500 dark:text-gray-400", border: "border-gray-300 dark:border-gray-600", light: "bg-gray-50 dark:bg-gray-900/20" },
}

const TYPE_LABELS: Record<string, string> = {
  c4Actor: "Actor", c4System: "System", c4Container: "Container", c4Component: "Component", c4Boundary: "Boundary",
  flowAction: "Action", flowDecision: "Decision", flowScreen: "Screen", flowSwimlane: "Swimlane",
  cloudCompute: "Compute", cloudDatabase: "Database", cloudStorage: "Storage", cloudNetwork: "Network",
  cloudMessaging: "Messaging", cloudSecurity: "Security", cloudAnalytics: "Analytics", cloudBoundary: "Boundary",
}

const STATUS_CLASSES: Record<string, string> = {
  normal: "bg-green-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  proposed: "bg-blue-500",
}

// ============================================================================
// Base node — used by all 17 node types
// ============================================================================

function rfPosition(rfPos: string): Position {
  return rfPos as Position
}

export function BaseNode({ data, selected, nodeType }: { data: NodeData; selected?: boolean; nodeType: string }) {
  const theme = TYPE_THEMES[nodeType] || TYPE_THEMES.c4System
  const typeLabel = TYPE_LABELS[nodeType] || "Node"
  const isBoundary = nodeType === "c4Boundary" || nodeType === "cloudBoundary"
  const isSwimlane = nodeType === "flowSwimlane"
  const handles = (data.handles || []) as HandleConfig[]
  const isDashed = data.borderStyle === "dashed" || isBoundary

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-card text-card-foreground shadow-sm transition-all",
        isDashed ? "border-dashed" : "border-solid",
        isSwimlane ? "w-full" : "min-w-[240px] max-w-[320px]",
        selected && "ring-2 ring-ring shadow-md",
        !selected && "hover:shadow-md",
        theme.border,
      )}
    >
      {/* Handles — computed by the post-processor */}
      {handles.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type={h.type}
          position={rfPosition(h.position)}
          style={{
            left: `${h.x * 100}%`,
            top: `${h.y * 100}%`,
            width: 8,
            height: 8,
            borderWidth: 2,
            transform: "translate(-50%, -50%)",
          }}
          className="border-border bg-background"
        />
      ))}

      {/* Left accent stripe */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", theme.accent.replace("text-", "bg-"))} />

      <div className={cn("p-3 pl-4", isSwimlane && "flex items-center gap-4")}>
        {/* Badge row */}
        <div className="flex items-center justify-between mb-2">
          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-widest", theme.badge, theme.badgeText)}>
            {typeLabel}
          </span>
          {data.statusState && (
            <span className={cn("w-2 h-2 rounded-full", STATUS_CLASSES[data.statusState] || STATUS_CLASSES.normal)} />
          )}
        </div>

        {/* Title */}
        <div className="mb-1.5">
          <h3 className={cn("text-sm font-semibold truncate", theme.accent)}>
            {data.label}
          </h3>
          {data.subtitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{data.subtitle}</p>
          )}
        </div>

        {/* Tech tags */}
        {!isSwimlane && (
          <div className="flex flex-wrap gap-1">
            {data.languageRuntime && data.languageRuntime !== "none" && (
              <span className={cn("px-1.5 py-0.5 text-[10px] font-medium rounded", theme.badge, theme.badgeText)}>
                {data.languageRuntime}
              </span>
            )}
            {data.frameworkLibrary && data.frameworkLibrary !== "none" && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                {data.frameworkLibrary}
              </span>
            )}
            {data.databaseEngine && data.databaseEngine !== "none" && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300">
                {data.databaseEngine}
              </span>
            )}
            {data.cloudServiceName && data.cloudServiceName !== "none" && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                {data.cloudServiceName}
              </span>
            )}
            {data.cloudTier && data.cloudTier !== "none" && (
              <span className={cn("px-1.5 py-0.5 text-[10px] font-medium rounded", theme.badge, theme.badgeText)}>
                {data.cloudTier}
              </span>
            )}
            {data.metadataTags && data.metadataTags.length > 0 && data.metadataTags.slice(0, 3).map((tag, i) => (
              <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground border border-border">
                {tag}
              </span>
            ))}
            {data.metadataTags && data.metadataTags.length > 3 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground">
                +{data.metadataTags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Table info */}
        {!isSwimlane && data.tableName && (
          <div className="mt-1.5 text-[10px] font-mono text-muted-foreground truncate">
            {data.tableName}
            {data.columns && data.columns.length > 0 && ` (${data.columns.join(", ")})`}
          </div>
        )}

        {/* Swimlane orientation */}
        {isSwimlane && data.layoutOrientation && (
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{data.layoutOrientation}</span>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Individual node exports
// ============================================================================

export function C4ActorNode(p: { data: NodeData; selected?: boolean }) { return <BaseNode {...p} nodeType="c4Actor" /> }
export function C4SystemNode(p: { data: NodeData; selected?: boolean }) { return <BaseNode {...p} nodeType="c4System" /> }
export function C4ContainerNode(p: { data: NodeData; selected?: boolean }) { return <BaseNode {...p} nodeType="c4Container" /> }
export function C4ComponentNode(p: { data: NodeData; selected?: boolean }) { return <BaseNode {...p} nodeType="c4Component" /> }
export function C4BoundaryNode(p: { data: NodeData; selected?: boolean }) { return <BaseNode {...p} nodeType="c4Boundary" /> }
export function FlowActionNode(p: { data: NodeData; selected?: boolean }) { return <BaseNode {...p} nodeType="flowAction" /> }
export function FlowDecisionNode(p: { data: NodeData; selected?: boolean }) { return <BaseNode {...p} nodeType="flowDecision" /> }
export function FlowScreenNode(p: { data: NodeData; selected?: boolean }) { return <BaseNode {...p} nodeType="flowScreen" /> }
export function FlowSwimlaneNode(p: { data: NodeData; selected?: boolean }) { return <BaseNode {...p} nodeType="flowSwimlane" /> }
export function CloudComputeNode(p: { data: NodeData; selected?: boolean }) { return <BaseNode {...p} nodeType="cloudCompute" /> }
export function CloudDatabaseNode(p: { data: NodeData; selected?: boolean }) { return <BaseNode {...p} nodeType="cloudDatabase" /> }
export function CloudStorageNode(p: { data: NodeData; selected?: boolean }) { return <BaseNode {...p} nodeType="cloudStorage" /> }
export function CloudNetworkNode(p: { data: NodeData; selected?: boolean }) { return <BaseNode {...p} nodeType="cloudNetwork" /> }
export function CloudMessagingNode(p: { data: NodeData; selected?: boolean }) { return <BaseNode {...p} nodeType="cloudMessaging" /> }
export function CloudSecurityNode(p: { data: NodeData; selected?: boolean }) { return <BaseNode {...p} nodeType="cloudSecurity" /> }
export function CloudAnalyticsNode(p: { data: NodeData; selected?: boolean }) { return <BaseNode {...p} nodeType="cloudAnalytics" /> }
export function CloudBoundaryNode(p: { data: NodeData; selected?: boolean }) { return <BaseNode {...p} nodeType="cloudBoundary" /> }

// ============================================================================
// nodeTypes map
// ============================================================================

export const nodeTypes = {
  c4Actor: C4ActorNode,
  c4System: C4SystemNode,
  c4Container: C4ContainerNode,
  c4Component: C4ComponentNode,
  c4Boundary: C4BoundaryNode,
  flowAction: FlowActionNode,
  flowDecision: FlowDecisionNode,
  flowScreen: FlowScreenNode,
  flowSwimlane: FlowSwimlaneNode,
  cloudCompute: CloudComputeNode,
  cloudDatabase: CloudDatabaseNode,
  cloudStorage: CloudStorageNode,
  cloudNetwork: CloudNetworkNode,
  cloudMessaging: CloudMessagingNode,
  cloudSecurity: CloudSecurityNode,
  cloudAnalytics: CloudAnalyticsNode,
  cloudBoundary: CloudBoundaryNode,
}

// ============================================================================
// Custom edge — renders path + label + protocol, uses edge props directly
// ============================================================================

function getEdgePath(type: string, props: any) {
  switch (type) {
    case "smoothstep":
      return getSmoothStepPath(props)
    case "step":
      return getStraightPath(props)
    case "straight":
      return getStraightPath(props)
    default:
      return getBezierPath(props)
  }
}

export function CustomEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, label, data, selected, style: edgeStyle, markerEnd, markerStart, animated, type: edgeType } = props
  const edgeData = data as EdgeData | undefined
  const pathType = edgeType || "default"

  const [edgePath] = getEdgePath(pathType, {
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2

  return (
    <g>
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle as React.CSSProperties | undefined}
        markerEnd={markerEnd}
        markerStart={markerStart}
        className={cn(selected && "stroke-foreground/70")}
      />
      {label && (
        <text x={midX} y={midY - 8} textAnchor="middle" className="fill-muted-foreground text-[11px] font-medium">
          {label as string}
        </text>
      )}
      {edgeData?.protocol && edgeData.protocol !== "none" && (
        <text x={midX} y={midY + 10} textAnchor="middle" className="fill-muted-foreground/60 text-[9px] font-mono">
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
