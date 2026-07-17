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
  d2_sources: Record<string, string>  // diagram_id -> D2 source code
  svgs: Record<string, string>        // diagram_id -> SVG base64
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
  d2_sources: Record<string, string>
  svgs: Record<string, string>
  active_diagram_id: string
}

export interface Diagram {
  id: string
  name: string
  description: string
  d2_source: string          // D2 source code for rendering
  graph: Record<string, unknown>  // Full D2Diagram flat-graph JSON
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

/** Render D2 diagram to SVG via backend CLI. */
export async function renderD2Diagram(params: {
  d2_source: string
  format?: "svg" | "png" | "pdf" | "gif" | "pptx"
  theme_id?: number
  dark_theme_id?: number
  layout_engine?: "elk"
  direction?: "right" | "down" | "left" | "up"
  pad?: number
  sketch?: boolean
}): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Render failed (${res.status}): ${text}`)
  }
  return res.text()
}

/** Create a shared clipboard entry for cross-device text sharing. */
export async function createClipboard(text: string, ttlSeconds = 3600): Promise<{ code: string; url: string }> {
  const res = await fetch(`${BASE_URL}/clipboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, ttl_seconds: ttlSeconds }),
  })
  if (!res.ok) throw new Error("Failed to create clipboard")
  return res.json()
}

/** Retrieve clipboard text by code. */
export async function getClipboard(code: string): Promise<{ text: string }> {
  const res = await fetch(`${BASE_URL}/clipboard/${code}`)
  if (!res.ok) throw new Error("Clipboard not found or expired")
  return res.json()
}
