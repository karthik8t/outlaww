/**
 * API client for the outlaww backend.
 *
 * Base URL is configurable via VITE_API_URL env var (defaults to http://localhost:8000).
 */
export const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

export interface ChatRequest {
  session_id?: string
  text?: string
  action?: string
}

export interface RfData {
  nodes: any[]
  edges: any[]
  metadata: { layoutDirection: string }
}

export interface ChatResponse {
  session_id: string
  routed_to: string
  action_name: string
  reasoning: string
  events: EventDict[]
  final_text: string
  structured_output: unknown
  reflection: unknown
  diagrams: Diagram[]
  rf_data: Record<string, RfData>  // diagram_id -> React Flow data
  markdown_docs: MarkdownDoc[]
  active_ids: Record<string, string>
}

export interface EventDict {
  id: string
  author: string
  text: string
  output: unknown
  function_call: unknown
  function_response: unknown
  timestamp: number
}

export interface SessionDetail {
  session_id: string
  event_count: number
  events: EventDict[]
  state: Record<string, unknown>
}

export interface SessionListItem {
  session_id: string
  user_id: string
  last_update_time: number
}

export interface SessionsListResponse {
  sessions: SessionListItem[]
}

export interface DiagramsResponse {
  session_id: string
  diagrams: Diagram[]
  rf_data: Record<string, RfData>
  active_diagram_id: string
}

export interface Diagram {
  id: string
  name: string
  description: string
  graph: Record<string, unknown>  // ArchitectureDiagram JSON
  store: Record<string, unknown>  // tldraw store (backward compat)
  created_at: string
  updated_at: string
}

export interface MarkdownDocsResponse {
  session_id: string
  markdown_docs: MarkdownDoc[]
  active_markdown_id: string
}

export interface MarkdownDoc {
  id: string
  name: string
  content: string
  frontmatter: Record<string, unknown>
  [k: string]: unknown
}

export interface ActionsResponse {
  actions: AppAction[]
}

export interface AppAction {
  name: string
  description: string
  default_agent: string
  trigger_keywords: string[]
  examples: string[]
}

export interface AgentsResponse {
  agents: string[]
}

// ---------------------------------------------------------------------------
//  Fetch helpers
// ---------------------------------------------------------------------------

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GET ${path} failed (${res.status}): ${body}`)
  }
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST ${path} failed (${res.status}): ${text}`)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
//  API functions
// ---------------------------------------------------------------------------

/** Send a chat message (free-form text). */
export async function sendChatMessage(
  sessionId: string,
  text: string,
): Promise<ChatResponse> {
  return post<ChatResponse>("/chat", { session_id: sessionId, text })
}

/** Execute a predefined action. */
export async function sendAction(
  sessionId: string,
  action: string,
): Promise<ChatResponse> {
  return post<ChatResponse>("/chat", { session_id: sessionId, action })
}

/** List all sessions for the outlaww app. */
export async function listSessions(): Promise<SessionsListResponse> {
  return get<SessionsListResponse>("/chat/sessions")
}

/** Get full session details (events + state). */
export async function getSession(sessionId: string): Promise<SessionDetail> {
  return get<SessionDetail>(`/chat/sessions/${sessionId}`)
}

/** Get all diagrams for a session. */
export async function getDiagrams(sessionId: string): Promise<DiagramsResponse> {
  return get<DiagramsResponse>(`/chat/diagrams/${sessionId}`)
}

/** Get all markdown docs for a session. */
export async function getMarkdownDocs(sessionId: string): Promise<MarkdownDocsResponse> {
  return get<MarkdownDocsResponse>(`/chat/markdown/${sessionId}`)
}

/** List all predefined actions. */
export async function getActions(): Promise<ActionsResponse> {
  return get<ActionsResponse>("/chat/actions")
}

/** List all available agents. */
export async function getAgents(): Promise<AgentsResponse> {
  return get<AgentsResponse>("/chat/agents")
}

/** Transform a stored diagram (by diagram_id) to React Flow format. */
export async function transformDiagramToReactFlow(
  sessionId: string,
  diagramId: string,
): Promise<RfData> {
  return post<RfData>("/chat/transform/reactflow-from-diagram", {
    session_id: sessionId,
    diagram_id: diagramId,
  })
}

/** Create a new blank session. */
export async function createSession(): Promise<{ session_id: string }> {
  return post<{ session_id: string }>("/chat/sessions", {})
}

/** Delete a session. */
export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/chat/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DELETE /chat/sessions/${sessionId} failed (${res.status}): ${text}`)
  }
}


