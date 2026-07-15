/**
 * API client for the outlaww backend.
 *
 * Base URL is configurable via VITE_API_URL env var (defaults to http://localhost:8000).
 */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

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

export interface DiagramsResponse {
  session_id: string
  diagrams: Diagram[]
  active_diagram_id: string
}

export interface Diagram {
  id: string
  name: string
  description: string
  store: TLStore
  created_at: string
  updated_at: string
}

export interface TLStore {
  document: { id: string; name: string; [k: string]: unknown }
  page: Record<string, TLPage>
  shape: Record<string, TLShape>
  asset: Record<string, TLAsset>
  [k: string]: unknown
}

export interface TLPage {
  id: string
  name: string
  [k: string]: unknown
}

export interface TLShape {
  id: string
  type: string
  x: number
  y: number
  parentId: string
  index: string
  props: Record<string, unknown>
  [k: string]: unknown
}

export interface TLAsset {
  id: string
  type: string
  props: Record<string, unknown>
  [k: string]: unknown
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
