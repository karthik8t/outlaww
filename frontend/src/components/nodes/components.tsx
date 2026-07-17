import { cn } from "@/lib/utils"
import { MarkerType } from "@xyflow/react"

// ============================================================================
// Shared types
// ============================================================================

export interface NodeData {
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
  postExtent: string
  postBorderStyle: string
  layoutOrientation: string
  tableName: string
  columns: string[]
}

export interface NodeProps {
  data: NodeData
  selected?: boolean
}

export interface EdgeData {
  protocol: string
  flowDirection: string
  logicVariant: string
  reasoning: string
  purpose: string
  dependencyBenefit: string
  couplingJustification: string
}

// ============================================================================
// Lookups
// ============================================================================

const TYPE_COLORS: Record<string, { border: string; bg: string; accent: string; badge: string; badgeText: string }> = {
  c4Actor:       { border: "#6366f1", bg: "#eef2ff", accent: "#6366f1", badge: "#e0e7ff", badgeText: "#4338ca" },
  c4System:      { border: "#6366f1", bg: "#eef2ff", accent: "#6366f1", badge: "#e0e7ff", badgeText: "#4338ca" },
  c4Container:   { border: "#818cf8", bg: "#f5f3ff", accent: "#818cf8", badge: "#ede9fe", badgeText: "#6d28d9" },
  c4Component:   { border: "#a78bfa", bg: "#faf5ff", accent: "#a78bfa", badge: "#f3e8ff", badgeText: "#7e22ce" },
  c4Boundary:    { border: "#c4b5fd", bg: "#f5f3ff", accent: "#a78bfa", badge: "#ede9fe", badgeText: "#6d28d9" },
  flowAction:    { border: "#f59e0b", bg: "#fffbeb", accent: "#f59e0b", badge: "#fef3c7", badgeText: "#b45309" },
  flowDecision:  { border: "#ef4444", bg: "#fef2f2", accent: "#ef4444", badge: "#fee2e2", badgeText: "#b91c1c" },
  flowScreen:    { border: "#10b981", bg: "#ecfdf5", accent: "#10b981", badge: "#d1fae5", badgeText: "#047857" },
  flowSwimlane:  { border: "#6b7280", bg: "#f9fafb", accent: "#6b7280", badge: "#f3f4f6", badgeText: "#374151" },
  cloudCompute:  { border: "#3b82f6", bg: "#eff6ff", accent: "#3b82f6", badge: "#dbeafe", badgeText: "#1d4ed8" },
  cloudDatabase: { border: "#06b6d4", bg: "#ecfeff", accent: "#06b6d4", badge: "#cffafe", badgeText: "#0e7490" },
  cloudStorage:  { border: "#8b5cf6", bg: "#f5f3ff", accent: "#8b5cf6", badge: "#ede9fe", badgeText: "#6d21c9" },
  cloudNetwork:  { border: "#14b8a6", bg: "#f0fdfa", accent: "#14b8a6", badge: "#ccfbf1", badgeText: "#0f766e" },
  cloudMessaging:{ border: "#f97316", bg: "#fff7ed", accent: "#f97316", badge: "#fed7aa", badgeText: "#c2410c" },
  cloudSecurity: { border: "#64748b", bg: "#f8fafc", accent: "#64748b", badge: "#f1f5f9", badgeText: "#334155" },
  cloudAnalytics:{ border: "#ec4899", bg: "#fdf2f8", accent: "#ec4899", badge: "#fce7f3", badgeText: "#be185d" },
  cloudBoundary: { border: "#94a3b8", bg: "#f8fafc", accent: "#94a3b8", badge: "#f1f5f9", badgeText: "#475569" },
}

const TYPE_LABELS: Record<string, string> = {
  c4Actor: "Actor", c4System: "System", c4Container: "Container", c4Component: "Component", c4Boundary: "Boundary",
  flowAction: "Action", flowDecision: "Decision", flowScreen: "Screen", flowSwimlane: "Swimlane",
  cloudCompute: "Compute", cloudDatabase: "Database", cloudStorage: "Storage", cloudNetwork: "Network",
  cloudMessaging: "Messaging", cloudSecurity: "Security", cloudAnalytics: "Analytics", cloudBoundary: "Boundary",
}

const STATUS_DOT: Record<string, string> = {
  normal: "#22c55e", warning: "#f59e0b", error: "#ef4444", proposed: "#3b82f6",
}

// ============================================================================
// Base node component used by all node types
// ============================================================================

export function BaseNode({ data, selected, nodeType }: NodeProps & { nodeType: string }) {
  const colors = TYPE_COLORS[nodeType] || TYPE_COLORS.c4System
  const typeLabel = TYPE_LABELS[nodeType] || "Node"
  const isBoundary = nodeType === "c4Boundary" || nodeType === "cloudBoundary"
  const isSwimlane = nodeType === "flowSwimlane"

  return (
    <div
      className={cn(
        "relative rounded-lg bg-white dark:bg-gray-800 shadow-md transition-all",
        isBoundary && "border-2 border-dashed",
        !isBoundary && "border-2",
        selected && "ring-2 ring-primary",
      )}
      style={{
        borderColor: isBoundary ? colors.border + "80" : colors.border,
        minWidth: isSwimlane ? "100%" : "220px",
        maxWidth: isSwimlane ? "100%" : "300px",
        width: isSwimlane ? "100%" : "auto",
        backgroundColor: colors.bg,
      }}
    >
      {/* Type label */}
      <div
        className="absolute -top-2.5 left-3 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
        style={{ backgroundColor: colors.badge, color: colors.badgeText }}
      >
        {typeLabel}
      </div>

      {/* Status dot */}
      <div
        className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 z-10"
        style={{ backgroundColor: STATUS_DOT[data.statusState] || STATUS_DOT.normal }}
      />

      {/* Content */}
      <div className={cn("p-3 pt-4", isSwimlane && "flex items-center gap-4")}>
        {/* Header */}
        <div className={cn("flex items-start gap-2 mb-2", isSwimlane && "mb-0 min-w-[180px]")}>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm" style={{ color: colors.accent }}>
              {data.label}
            </h3>
            {data.subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{data.subtitle}</p>
            )}
          </div>
        </div>

        {!isSwimlane && (
          <>
            {/* Tech stack tags */}
            <div className="flex flex-wrap gap-1 mb-2">
              {data.languageRuntime !== "none" && (
                <span className="px-1.5 py-0.5 text-[10px] rounded" style={{ backgroundColor: colors.badge, color: colors.badgeText }}>
                  {data.languageRuntime}
                </span>
              )}
              {data.frameworkLibrary !== "none" && (
                <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                  {data.frameworkLibrary}
                </span>
              )}
              {data.databaseEngine !== "none" && (
                <span className="px-1.5 py-0.5 text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                  {data.databaseEngine}
                </span>
              )}
              {data.cloudServiceName !== "none" && (
                <span className="px-1.5 py-0.5 text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded">
                  {data.cloudServiceName}
                </span>
              )}
              {data.cloudTier !== "none" && (
                <span className="px-1.5 py-0.5 text-[10px] rounded" style={{ backgroundColor: colors.badge, color: colors.badgeText }}>
                  {data.cloudTier}
                </span>
              )}
            </div>

            {/* Metadata tags */}
            {data.metadataTags && data.metadataTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {data.metadataTags.map((tag, i) => (
                  <span key={i} className="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded border border-gray-200 dark:border-gray-600">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Table info */}
            {data.tableName && (
              <div className="mb-2 text-[10px] font-mono text-gray-500 dark:text-gray-400 truncate">
                table: {data.tableName}
                {data.columns && data.columns.length > 0 && ` (${data.columns.join(", ")})`}
              </div>
            )}

            {/* Reasoning */}
            <details className="group">
              <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
                <span>Details</span>
                <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </summary>
              <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded text-xs text-gray-700 dark:text-gray-300 space-y-1">
                {data.reasoning && <p><strong>Why:</strong> {data.reasoning}</p>}
                {data.purpose && <p><strong>Purpose:</strong> {data.purpose}</p>}
                {data.architectureBenefit && <p><strong>Benefit:</strong> {data.architectureBenefit}</p>}
                {data.designJustification && <p><strong>Design:</strong> {data.designJustification}</p>}
              </div>
            </details>
          </>
        )}

        {isSwimlane && data.layoutOrientation && (
          <span className="text-[10px] text-gray-400 uppercase">{data.layoutOrientation}</span>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Individual node components for each type
// ============================================================================

export function C4ActorNode(props: NodeProps) { return <BaseNode {...props} nodeType="c4Actor" /> }
export function C4SystemNode(props: NodeProps) { return <BaseNode {...props} nodeType="c4System" /> }
export function C4ContainerNode(props: NodeProps) { return <BaseNode {...props} nodeType="c4Container" /> }
export function C4ComponentNode(props: NodeProps) { return <BaseNode {...props} nodeType="c4Component" /> }
export function C4BoundaryNode(props: NodeProps) { return <BaseNode {...props} nodeType="c4Boundary" /> }
export function FlowActionNode(props: NodeProps) { return <BaseNode {...props} nodeType="flowAction" /> }
export function FlowDecisionNode(props: NodeProps) { return <BaseNode {...props} nodeType="flowDecision" /> }
export function FlowScreenNode(props: NodeProps) { return <BaseNode {...props} nodeType="flowScreen" /> }
export function FlowSwimlaneNode(props: NodeProps) { return <BaseNode {...props} nodeType="flowSwimlane" /> }
export function CloudComputeNode(props: NodeProps) { return <BaseNode {...props} nodeType="cloudCompute" /> }
export function CloudDatabaseNode(props: NodeProps) { return <BaseNode {...props} nodeType="cloudDatabase" /> }
export function CloudStorageNode(props: NodeProps) { return <BaseNode {...props} nodeType="cloudStorage" /> }
export function CloudNetworkNode(props: NodeProps) { return <BaseNode {...props} nodeType="cloudNetwork" /> }
export function CloudMessagingNode(props: NodeProps) { return <BaseNode {...props} nodeType="cloudMessaging" /> }
export function CloudSecurityNode(props: NodeProps) { return <BaseNode {...props} nodeType="cloudSecurity" /> }
export function CloudAnalyticsNode(props: NodeProps) { return <BaseNode {...props} nodeType="cloudAnalytics" /> }
export function CloudBoundaryNode(props: NodeProps) { return <BaseNode {...props} nodeType="cloudBoundary" /> }

// ============================================================================
// nodeTypes map for React Flow
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
// Custom Edge Component
// ============================================================================

export function CustomEdge({
  id, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  label, data, selected,
}: {
  id: string; sourceX: number; sourceY: number; sourcePosition: any;
  targetX: number; targetY: number; targetPosition: any;
  label?: React.ReactNode; data?: EdgeData; selected?: boolean;
}) {
  const isAnimated = data?.logicVariant !== "standard_flow"
  const markerEnd = { type: MarkerType.ArrowClosed as const, width: 20, height: 20, color: isAnimated ? "#3b82f6" : "#9ca3af" }
  const markerStart = data?.flowDirection === "reverse" ? { type: MarkerType.ArrowClosed as const, width: 20, height: 20, color: isAnimated ? "#3b82f6" : "#9ca3af" } : undefined

  const pathStyle: React.CSSProperties = {
    stroke: isAnimated ? "#3b82f6" : "#9ca3af",
    strokeWidth: isAnimated ? 2 : 1.5,
    strokeDasharray: isAnimated ? "5,5" : "none",
  }

  const getPath = () => {
    const dx = targetX - sourceX
    const dy = targetY - sourceY
    const curve = Math.min(Math.max(Math.abs(dx), Math.abs(dy)) * 0.3, 150)
    const sx = sourceX + (sourcePosition === "right" ? curve : sourcePosition === "left" ? -curve : 0)
    const sy = sourceY + (sourcePosition === "bottom" ? curve : sourcePosition === "top" ? -curve : 0)
    const tx = targetX + (targetPosition === "left" ? curve : targetPosition === "right" ? -curve : 0)
    const ty = targetY + (targetPosition === "top" ? curve : targetPosition === "bottom" ? -curve : 0)
    return `M${sourceX},${sourceY} C${sx},${sy} ${tx},${ty} ${targetX},${targetY}`
  }

  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2

  return (
    <g>
      <path id={`${id}-path`} d={getPath()} fill="none" style={pathStyle} markerEnd={markerEnd as any} markerStart={markerStart as any} />
      {label && (
        <text x={midX} y={midY - 10} textAnchor="middle" className="text-xs font-medium text-gray-600 dark:text-gray-400">
          <tspan dx="-2" dy="0">{label as string}</tspan>
        </text>
      )}
      {data?.protocol && data.protocol !== "none" && (
        <text x={midX} y={midY + 12} textAnchor="middle" className="text-[9px] text-gray-400 dark:text-gray-500 font-mono">
          {data.protocol}
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
