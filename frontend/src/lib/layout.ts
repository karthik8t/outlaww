import ELK from "elkjs/lib/elk.bundled.js"

const elk = new ELK()

const NODE_WIDTH  = 260
const NODE_HEIGHT = 160
// Containers get a generous initial size — ELK will auto-expand them
const CONTAINER_MIN_W = 400
const CONTAINER_MIN_H = 300

const DIRECTION_MAP: Record<string, string> = {
  TB: "DOWN",
  LR: "RIGHT",
  BT: "UP",
  RL: "LEFT",
}

// Node types that act as visual containers (have child nodes nested inside them)
const CONTAINER_TYPES = new Set([
  "deploymentGroup", "serviceGroup", "domainGroup", "dataGroup", "networkGroup",
  "c4Boundary", "cloudBoundary", "group", "flowSwimlane",
])

// ============================================================================
// Hierarchical ELK layout
// Builds a nested ELK graph respecting parentId relationships so containers
// actually wrap their children in the rendered output.
// ============================================================================

export async function layoutNodes(
  nodes: any[],
  edges: any[],
  direction: "TB" | "LR" | "BT" | "RL" = "LR",
) {
  const elkDir = DIRECTION_MAP[direction] || "RIGHT"

  // ── 1. Build parent → children map ────────────────────────────────────────
  const childrenByParent: Record<string, any[]> = {}
  const rootNodes: any[] = []

  for (const node of nodes) {
    const pid = node.parentId ?? node.data?.parentNode ?? null
    if (pid) {
      if (!childrenByParent[pid]) childrenByParent[pid] = []
      childrenByParent[pid].push(node)
    } else {
      rootNodes.push(node)
    }
  }

  // ── 2. Recursively build ELK children ────────────────────────────────────
  function buildElkNode(node: any): any {
    const kids = childrenByParent[node.id] || []
    const isContainer = CONTAINER_TYPES.has(node.type) || kids.length > 0

    const elkNode: any = {
      id: node.id,
      width:  isContainer ? CONTAINER_MIN_W : NODE_WIDTH,
      height: isContainer ? CONTAINER_MIN_H : NODE_HEIGHT,
    }

    if (isContainer && kids.length > 0) {
      elkNode.layoutOptions = {
        "elk.algorithm":    "layered",
        "elk.direction":    elkDir,
        "elk.spacing.nodeNode": "40",
        "elk.layered.spacing.nodeNodeBetweenLayers": "60",
        // Reserve space at top for the container label bar
        "elk.padding": "[top=48, left=24, right=24, bottom=24]",
        "elk.nodeLabels.placement": "INSIDE V_TOP H_LEFT",
      }
      elkNode.children = kids.map(buildElkNode)
      // Only include edges that connect two nodes within this same container
      const kidIds = new Set(kids.map((k: any) => k.id))
      elkNode.edges = edges
        .filter(e => kidIds.has(e.source) && kidIds.has(e.target))
        .map(e => ({ id: e.id, sources: [e.source], targets: [e.target] }))
    }

    return elkNode
  }

  // ── 3. Cross-container edges go at root level ─────────────────────────────
  // An edge is "cross-container" if its source and target don't share the same
  // immediate parent. ELK must see these at the root level.
  function getParentId(nodeId: string): string | null {
    for (const [pid, kids] of Object.entries(childrenByParent)) {
      if (kids.some((k: any) => k.id === nodeId)) return pid
    }
    return null
  }

  const rootEdges = edges.filter(e => {
    const sp = getParentId(e.source)
    const tp = getParentId(e.target)
    // Cross-container or root-level edges
    return sp !== tp || (sp === null && tp === null)
  })

  const graph: any = {
    id: "root",
    layoutOptions: {
      "elk.algorithm":    "layered",
      "elk.direction":    elkDir,
      "elk.spacing.nodeNode": "80",
      "elk.layered.spacing.nodeNodeBetweenLayers": "100",
    },
    children: rootNodes.map(buildElkNode),
    edges: rootEdges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  }

  // ── 4. Run ELK ────────────────────────────────────────────────────────────
  const layout = await elk.layout(graph)

  // ── 5. Recursively collect positions (nested children use parent-relative coords)
  const positions: Record<string, { x: number; y: number }> = {}

  function collectPositions(elkChildren: any[]) {
    for (const child of elkChildren || []) {
      positions[child.id] = { x: child.x || 0, y: child.y || 0 }
      if (child.children?.length) {
        collectPositions(child.children)
      }
    }
  }

  collectPositions(layout.children || [])

  // ── 6. Apply positions back to nodes ─────────────────────────────────────
  return nodes.map(node => ({
    ...node,
    position: positions[node.id] || { x: 0, y: 0 },
  }))
}
