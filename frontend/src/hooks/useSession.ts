import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import * as api from "@/lib/api"
import type { EventDict, AgentOutputDict } from "@/lib/api"

// ---------------------------------------------------------------------------
//  ChatMsg — consolidated turn between user messages
// ---------------------------------------------------------------------------

export interface ChatMsg {
  id: string
  timestamp?: string
  userText?: string
  agentsInvolved: string[]
  /** Primary response text — the reflection's interaction_summary */
  agentResponse?: string
  /** Full dispatch text (shown in collapsible if different from agentResponse) */
  agentText?: string
  reflectionSummary?: string
  reflectionGoals?: string[]
  structuredOutputs?: Array<{ agent: string; output: Record<string, unknown> }>
  isError?: boolean
}

// ---------------------------------------------------------------------------
//  groupEventsIntoTurns  — consolidate all events between user messages
//  into a single turn per user message
// ---------------------------------------------------------------------------

/** Agents to exclude from the visible agent chain */
const _SYSTEM_AUTHORS = new Set(["user", "router", "reflection", "outlaww_text_workflow", "outlaww_action_workflow"])

export function groupEventsIntoTurns(events: EventDict[]): ChatMsg[] {
  const turns: ChatMsg[] = []
  let currentTurn: ChatMsg | null = null

  for (const e of events) {
    const timeStr = e.timestamp
      ? new Date(e.timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

    if (e.event_class === "user") {
      if (currentTurn) {
        turns.push(currentTurn)
      }
      currentTurn = {
        id: e.id || `turn-${Date.now()}-${Math.random()}`,
        timestamp: timeStr,
        userText: e.text,
        agentsInvolved: [],
      }
    } else {
      if (!currentTurn) {
        currentTurn = {
          id: e.id || `turn-${Date.now()}-${Math.random()}`,
          timestamp: timeStr,
          agentsInvolved: [],
        }
      }

      const { author } = e
      if (author && !_SYSTEM_AUTHORS.has(author)) {
        if (!currentTurn.agentsInvolved.includes(author)) {
          currentTurn.agentsInvolved.push(author)
        }
      }

      // Reflection — extract interaction_summary as agentResponse + goals
      if (e.agent_output?.reflection) {
        currentTurn.agentResponse = e.agent_output.reflection.interaction_summary || undefined
        currentTurn.reflectionSummary = e.agent_output.reflection.summary || undefined
        if (e.agent_output.reflection.new_goals?.length) {
          currentTurn.reflectionGoals = e.agent_output.reflection.new_goals
        }
      }

      // Agent output / text events — capture text and structured outputs
      if (e.event_class === "agent_output" || e.event_class === "agent_text") {
        if (e.text && !_SYSTEM_AUTHORS.has(author)) {
          currentTurn.agentText = e.text
        }
        // Collect structured output keyed by agent
        const agentOut = e.agent_output?.[author as keyof AgentOutputDict]
        if (agentOut && !_SYSTEM_AUTHORS.has(author)) {
          if (!currentTurn.structuredOutputs) {
            currentTurn.structuredOutputs = []
          }
          currentTurn.structuredOutputs.push({
            agent: author,
            output: agentOut as Record<string, unknown>,
          })
        }
      }
    }
  }

  if (currentTurn) {
    turns.push(currentTurn)
  }

  return turns
}

// ---------------------------------------------------------------------------
//  Hook
// ---------------------------------------------------------------------------

export function useSession() {
  const { sessionId: routeSessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  // ---- session state ----
  const [sessionId, setSessionId] = useState<string | null>(
    () => routeSessionId ? decodeURIComponent(routeSessionId) : null
  )
  const [ready, setReady] = useState(true)

  // ---- data from backend ----
  const [sessions, setSessions] = useState<api.SessionListItem[]>([])
  const [diagrams, setDiagrams] = useState<api.Diagram[]>([])
  const [rfData, setRfData] = useState<Record<string, api.RfData>>({})
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

  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId

  // ---- boot: load actions + agents + sessions list ----
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
        if (sessRes && sessRes.events.length > 0) {
          const hist = groupEventsIntoTurns(sessRes.events)
          setMessages(hist)
        }
      })
      .finally(() => setReady(true))
  }, [sessionId])

  // ---- sync with route param changes ----
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

    const tempTurn: ChatMsg = {
      id: `temp-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      userText: text.trim(),
      agentsInvolved: [],
    }
    setMessages((prev) => [...prev, tempTurn])
    setSending(true)

    try {
      const res = await api.sendChatMessage(sessionIdRef.current || crypto.randomUUID(), text)

      if (!sessionIdRef.current) {
        setSessionId(res.session_id)
        navigate(`/session/${encodeURIComponent(res.session_id)}`, { replace: true })
      }

      const finalTurn: ChatMsg = {
        id: `turn-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        userText: text.trim(),
        agentsInvolved: res.agents_involved || [],
        agentResponse: res.final_text || "(no response)",
        structuredOutputs: (res.structured_outputs ?? []) as Array<{ agent: string; output: Record<string, unknown> }>,
      }

      const ref = res.reflection as any
      if (ref) {
        if (ref.summary) {
          finalTurn.reflectionSummary = ref.summary
        }
        if (Array.isArray(ref.new_goals) && ref.new_goals.length > 0) {
          finalTurn.reflectionGoals = ref.new_goals
        }
      }

      setMessages((prev) => {
        const copy = [...prev]
        copy[copy.length - 1] = finalTurn
        return copy
      })

      if (res.diagrams.length > 0) {
        setDiagrams(res.diagrams)
      }
      if (res.rf_data) setRfData(res.rf_data)
      if (res.markdown_docs.length > 0) setMarkdownDocs(res.markdown_docs)
    } catch (err) {
      console.error("chat error:", err)
      const errMsg: ChatMsg = {
        id: `err-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        userText: text.trim(),
        agentText: `Error: ${err instanceof Error ? err.message : "unknown"}`,
        agentsInvolved: [],
        isError: true,
      }
      setMessages((prev) => {
        const copy = [...prev]
        copy[copy.length - 1] = errMsg
        return copy
      })
    } finally {
      setSending(false)
    }
  }, [sending])

  // ---- execute predefined action ----
  const runAction = useCallback(async (actionName: string) => {
    if (sending) return

    const tempTurn: ChatMsg = {
      id: `temp-act-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      userText: `Action: ${actionName.replace(/_/g, " ")}`,
      agentsInvolved: [],
    }
    setMessages((prev) => [...prev, tempTurn])
    setSending(true)

    try {
      const res = await api.sendAction(sessionIdRef.current || crypto.randomUUID(), actionName)

      if (!sessionIdRef.current) {
        setSessionId(res.session_id)
        navigate(`/session/${encodeURIComponent(res.session_id)}`, { replace: true })
      }

      const finalTurn: ChatMsg = {
        id: `act-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        userText: `Action: ${actionName.replace(/_/g, " ")}`,
        agentsInvolved: res.agents_involved || [],
        agentResponse: res.final_text || `Action "${actionName}" completed`,
        structuredOutputs: (res.structured_outputs ?? []) as Array<{ agent: string; output: Record<string, unknown> }>,
      }

      const ref = res.reflection as any
      if (ref) {
        if (ref.summary) {
          finalTurn.reflectionSummary = ref.summary
        }
        if (Array.isArray(ref.new_goals) && ref.new_goals.length > 0) {
          finalTurn.reflectionGoals = ref.new_goals
        }
      }

      setMessages((prev) => {
        const copy = [...prev]
        copy[copy.length - 1] = finalTurn
        return copy
      })

      if (res.diagrams.length > 0) {
        setDiagrams(res.diagrams)
      }
      if (res.rf_data) setRfData(res.rf_data)
      if (res.markdown_docs.length > 0) setMarkdownDocs(res.markdown_docs)
    } catch (err) {
      console.error("action error:", err)
      const errMsg: ChatMsg = {
        id: `err-act-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        userText: `Action: ${actionName.replace(/_/g, " ")}`,
        agentText: `Error: ${err instanceof Error ? err.message : "unknown"}`,
        agentsInvolved: [],
        isError: true,
      }
      setMessages((prev) => {
        const copy = [...prev]
        copy[copy.length - 1] = errMsg
        return copy
      })
    } finally {
      setSending(false)
    }
  }, [sending])

  return {
    sessionId,
    ready,
    sessions,
    diagrams,
    rfData,
    markdownDocs,
    actions,
    agents,
    messages,
    sending,
    sendMessage,
    runAction,
    selectedDiagramId,
    setSelectedDiagramId,
    selectedDocId,
    setSelectedDocId,
    sidebarView,
    setSidebarView,
    refreshSessions,
    refreshDiagrams,
    refreshDocs,
    fetchDiagramSource,
  }
}