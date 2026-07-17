import ELK from "elkjs/lib/elk.bundled.js"

const elk = new ELK()

const NODE_WIDTH = 260
const NODE_HEIGHT = 180

const DIRECTION_MAP: Record<string, string> = {
  TB: "DOWN",
  LR: "RIGHT",
  BT: "UP",
  RL: "LEFT",
}

export async function layoutNodes(
  nodes: any[],
  edges: any[],
  direction: "TB" | "LR" | "BT" | "RL" = "LR",
) {
  const graph: any = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": DIRECTION_MAP[direction] || "RIGHT",
      "elk.spacing.nodeNode": "60",
      "elk.layered.spacing.nodeNodeBetweenLayers": "80",
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  }

  const layout = await elk.layout(graph)

  const positions: Record<string, { x: number; y: number }> = {}
  for (const child of layout.children || []) {
    positions[child.id] = { x: child.x || 0, y: child.y || 0 }
  }

  return nodes.map((node) => ({
    ...node,
    position: positions[node.id] || { x: 0, y: 0 },
  }))
}
