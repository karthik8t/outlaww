/**
 * useSession — manages session lifecycle and backend data.
 *
 * - Reads session ID from React Router /session/:sessionId
 * - Creates new session on first message if none in URL
 * - Syncs diagrams / markdown docs after each chat response
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import * as api from "@/lib/api"

// ---------------------------------------------------------------------------
//  Hook
// ---------------------------------------------------------------------------

export interface ChatMsg {
  id: string
  role: "system" | "user" | "agent"
  text: string
  timestamp: string
  actions?: string[]
  routedTo?: string
  structuredOutput?: Record<string, unknown>
}

export function useSession() {
  const { sessionId: routeSessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  // ---- session state ----
  const [sessionId, setSessionId] = useState<string | null>(
    () => routeSessionId ? decodeURIComponent(routeSessionId) : null
  )
  const [ready, setReady] = useState(true) // false while loading session data on mount

  // ---- data from backend ----
  const [sessions, setSessions] = useState<api.SessionListItem[]>([])
  const [diagrams, setDiagrams] = useState<api.Diagram[]>([])
  const [rfData, setRfData] = useState<Record<string, api.RfData>>({}) // diagram_id -> React Flow data
  const [markdownDocs, setMarkdownDocs] = useState<api.MarkdownDoc[]>([])
  const [actions, setActions] = useState<api.AppAction[]>([])
  const [agents, setAgents] = useState<string[]>([])

  // ---- chat messages (local UI state) ----
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [sending, setSending] = useState(false)

  // ---- selected artifacts ----
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(null)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)

  // ---- active view in sidebar ----
  const [sidebarView, setSidebarView] = useState<"chat" | "diagrams" | "docs" | "actions" | "agents">("chat")

  // Ref to avoid stale closures in async callbacks
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId

  // ---- boot: load actions + agents + sessions list (session-independent) ----
  useEffect(() => {
    api.getActions().then((r) => setActions(r.actions)).catch(console.error)
    api.getAgents().then((r) => setAgents(r.agents)).catch(console.error)
    api.listSessions().then((r) => setSessions(r.sessions)).catch(console.error)
  }, [])

  // ---- boot: if session exists in URL, load its data ----
  useEffect(() => {
    if (!sessionId) {
      setReady(true)
      return
    }
    setReady(false)
    Promise.all([
      api.getDiagrams(sessionId).catch(() => null),
      api.getMarkdownDocs(sessionId).catch(() => null),
      api.getSession(sessionId).catch(() => null),
    ])
      .then(([diagRes, mdRes, sessRes]) => {
        if (diagRes) {
          setDiagrams(diagRes.diagrams)
          if (diagRes.rf_data) setRfData(diagRes.rf_data)
        }
        if (mdRes) setMarkdownDocs(mdRes.markdown_docs)
        // Rehydrate chat from session events (optional)
        if (sessRes && sessRes.events.length > 0) {
          const hist: ChatMsg[] = sessRes.events
            .filter((e) => e.author && e.author !== "user")
            .map((e, i) => ({
              id: `hist-${i}`,
              role: "agent" as const,
              text: e.text || "",
              timestamp: new Date(e.timestamp * 1000).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              routedTo: e.author,
            }))
          setMessages(hist)
        }
      })
      .finally(() => setReady(true))
  }, [sessionId])

  // ---- sync with route param changes (back/forward via React Router) ----
  useEffect(() => {
    const id = routeSessionId ? decodeURIComponent(routeSessionId) : null
    setSessionId(id)
  }, [routeSessionId])

  // ---- refresh helpers ----
  const refreshSessions = useCallback(async () => {
    try {
      const res = await api.listSessions()
      setSessions(res.sessions)
    } catch { /* ignore */ }
  }, [])

  const refreshDiagrams = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      const res = await api.getDiagrams(sid)
      setDiagrams(res.diagrams)
      if (res.rf_data) setRfData(res.rf_data)
    } catch { /* ignore */ }
  }, [])

  // Fetch a specific diagram's React Flow data
  const fetchDiagramSource = useCallback(async (diagramId: string) => {
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      const rf = await api.transformDiagramToReactFlow(sid, diagramId)
      setRfData(prev => ({ ...prev, [diagramId]: rf }))
    } catch { /* ignore */ }
  }, [])

  const refreshDocs = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      const res = await api.getMarkdownDocs(sid)
      setMarkdownDocs(res.markdown_docs)
    } catch { /* ignore */ }
  }, [])

  // ---- send message ----
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || sending) return

    const userMsg: ChatMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)

    try {
      // Use existing sessionId or let backend create one
      const res = await api.sendChatMessage(sessionIdRef.current || crypto.randomUUID(), text)

      // Update session ID if new
      if (!sessionIdRef.current) {
        setSessionId(res.session_id)
        navigate(`/session/${encodeURIComponent(res.session_id)}`, { replace: true })
      }

      const agentMsg: ChatMsg = {
        id: `agent-${Date.now()}`,
        role: "agent",
        text: res.final_text || "(no response)",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        routedTo: res.routed_to,
        structuredOutput: (res.structured_output as Record<string, unknown>) || undefined,
      }
      setMessages((prev) => [...prev, agentMsg])

      // Sync diagrams / docs from response
      if (res.diagrams.length > 0) {
        setDiagrams(res.diagrams)
      }
      if (res.rf_data) setRfData(res.rf_data)
      if (res.markdown_docs.length > 0) setMarkdownDocs(res.markdown_docs)
    } catch (err) {
      console.error("chat error:", err)
      const errMsg: ChatMsg = {
        id: `err-${Date.now()}`,
        role: "system",
        text: `Error: ${err instanceof Error ? err.message : "unknown"}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setSending(false)
    }
  }, [sending])

  // ---- execute predefined action ----
  const runAction = useCallback(async (actionName: string) => {
    if (sending) return

    setSending(true)
    try {
      const res = await api.sendAction(sessionIdRef.current || crypto.randomUUID(), actionName)

      if (!sessionIdRef.current) {
        setSessionId(res.session_id)
        navigate(`/session/${encodeURIComponent(res.session_id)}`, { replace: true })
      }

      const agentMsg: ChatMsg = {
        id: `action-${Date.now()}`,
        role: "agent",
        text: res.final_text || `Action "${actionName}" completed`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        routedTo: res.routed_to,
        structuredOutput: (res.structured_output as Record<string, unknown>) || undefined,
      }
      setMessages((prev) => [...prev, agentMsg])

      if (res.diagrams.length > 0) {
        setDiagrams(res.diagrams)
      }
      if (res.rf_data) setRfData(res.rf_data)
      if (res.markdown_docs.length > 0) setMarkdownDocs(res.markdown_docs)
    } catch (err) {
      console.error("action error:", err)
    } finally {
      setSending(false)
    }
  }, [sending])

  return {
    // session
    sessionId,
    ready,
    // data
    sessions,
    diagrams,
    rfData,
    markdownDocs,
    actions,
    agents,
    // messages
    messages,
    sending,
    sendMessage,
    runAction,
    // selected artifacts
    selectedDiagramId,
    setSelectedDiagramId,
    selectedDocId,
    setSelectedDocId,
    // sidebar
    sidebarView,
    setSidebarView,
    // refresh
    refreshSessions,
    refreshDiagrams,
    refreshDocs,
    fetchDiagramSource,
  }
}