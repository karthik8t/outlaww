import ELK from "elkjs/lib/elk.bundled.js"

const elk = new ELK()

// Leaf node dimensions (px) — used as hints to ELK for spacing calculations
const NODE_W = 260
const NODE_H = 160

// Container initial sizes — ELK will auto-expand to fit children + padding
const CONTAINER_W = 440
const CONTAINER_H = 320

const DIRECTION_MAP: Record<string, string> = {
  TB: "DOWN",
  LR: "RIGHT",
  BT: "UP",
  RL: "LEFT",
}

// Types that act as visual parent containers in the React Flow graph
const CONTAINER_TYPES = new Set([
  "deploymentGroup", "serviceGroup", "domainGroup", "dataGroup", "networkGroup",
  "c4Boundary", "cloudBoundary", "group", "flowSwimlane",
])

// ============================================================================
// Topological sort — React Flow REQUIRES parents to appear before children.
// Without this, child nodes may render before their parent exists.
// ============================================================================
function topoSort(nodes: any[]): any[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const visited = new Set<string>()
  const result: any[] = []

  function visit(n: any) {
    if (visited.has(n.id)) return
    const pid = n.parentId ?? null
    if (pid && nodeMap.has(pid)) visit(nodeMap.get(pid)!)
    visited.add(n.id)
    result.push(n)
  }

  nodes.forEach(visit)
  return result
}

// ============================================================================
// Hierarchical ELK layout
//
// Industry-standard approach for React Flow subflows:
//   1. Build a nested ELK graph matching the parentId hierarchy
//   2. Run ELK — it returns positions AND computed sizes for every node
//   3. Write width + height back to every node so React Flow knows exact bounds
//   4. Child positions from ELK are already parent-relative (React Flow expects this)
//   5. Sort parents before children (topological order)
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
    const pid = node.parentId ?? null
    if (pid) {
      if (!childrenByParent[pid]) childrenByParent[pid] = []
      childrenByParent[pid].push(node)
    } else {
      rootNodes.push(node)
    }
  }

  // ── 2. Recursively build ELK node descriptors ─────────────────────────────
  // Each container gets layout options + nested children.
  // Each leaf gets fixed width/height hints.
  function buildElkNode(node: any): any {
    const kids = childrenByParent[node.id] || []
    const hasKids = kids.length > 0
    const isContainer = CONTAINER_TYPES.has(node.type)

    const elkNode: any = {
      id: node.id,
      // Containers: generous initial size; ELK expands to fit children
      // Leaves: fixed dimensions matching our card component
      width:  (isContainer || hasKids) ? CONTAINER_W : NODE_W,
      height: (isContainer || hasKids) ? CONTAINER_H : NODE_H,
    }

    if (hasKids) {
      // Sub-layout options for this container's children
      elkNode.layoutOptions = {
        "elk.algorithm":    "layered",
        "elk.direction":    elkDir,
        "elk.spacing.nodeNode": "50",
        "elk.layered.spacing.nodeNodeBetweenLayers": "70",
        // 48px top = space for the container label header bar
        "elk.padding": "[top=52, left=28, right=28, bottom=28]",
      }
      elkNode.children = kids.map(buildElkNode)
      // Inner edges: only those connecting two direct children of this node
      const kidIds = new Set(kids.map((k: any) => k.id))
      elkNode.edges = edges
        .filter(e => kidIds.has(e.source) && kidIds.has(e.target))
        .map(e => ({ id: `inner-${e.id}`, sources: [e.source], targets: [e.target] }))
    }

    return elkNode
  }

  // ── 3. Root-level edges (cross-container or between root nodes) ────────────
  // An edge is "cross-container" when source and target are in different parents.
  const parentOf: Record<string, string | null> = {}
  for (const node of nodes) parentOf[node.id] = node.parentId ?? null

  const rootEdges = edges.filter(e => {
    const sp = parentOf[e.source]
    const tp = parentOf[e.target]
    return sp !== tp  // different parents → must be at root level
  })

  const graph: any = {
    id: "root",
    layoutOptions: {
      "elk.algorithm":    "layered",
      "elk.direction":    elkDir,
      "elk.spacing.nodeNode": "100",
      "elk.layered.spacing.nodeNodeBetweenLayers": "120",
    },
    children: rootNodes.map(buildElkNode),
    edges: rootEdges.map(e => ({ id: `root-${e.id}`, sources: [e.source], targets: [e.target] })),
  }

  // ── 4. Run ELK ────────────────────────────────────────────────────────────
  const layout = await elk.layout(graph)

  // ── 5. Collect positions AND computed sizes from ELK output ───────────────
  //
  // CRITICAL: ELK computes the actual width/height of every node after layout
  // (containers are expanded to fit their children). We must write these back
  // to the React Flow nodes so:
  //   a) React Flow knows the exact parent size for extent: "parent" bounds
  //   b) The node wrapper div is sized correctly (no DOM measurement mismatch)
  //
  // Child positions from ELK are already parent-relative — React Flow expects
  // exactly this format when parentId is set.
  const positions: Record<string, { x: number; y: number }> = {}
  const sizes:     Record<string, { width: number; height: number }> = {}

  function collectLayout(elkChildren: any[]) {
    for (const child of elkChildren || []) {
      positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 }
      sizes[child.id]     = { width: child.width ?? NODE_W, height: child.height ?? NODE_H }
      if (child.children?.length) collectLayout(child.children)
    }
  }

  collectLayout(layout.children || [])

  // ── 6. Apply positions + sizes and sort (parents before children) ─────────
  const laid = nodes.map(node => {
    const pos  = positions[node.id] ?? { x: 0, y: 0 }
    const size = sizes[node.id]     ?? { width: NODE_W, height: NODE_H }

    return {
      ...node,
      position: pos,
      // Explicit width/height tell React Flow the node size without DOM measurement.
      // This is what makes extent: "parent" work correctly and prevents the
      // exponential drag bug caused by size mismatches.
      width:  size.width,
      height: size.height,
      style: {
        ...(node.style ?? {}),
        width:  size.width,
        height: size.height,
      },
    }
  })

  // React Flow requires parent nodes to precede their children in the array.
  return topoSort(laid)
}
