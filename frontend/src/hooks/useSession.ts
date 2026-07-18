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
import type { EventDict, AgentOutputDict } from "@/lib/api"

// ---------------------------------------------------------------------------
//  Hook
// ---------------------------------------------------------------------------

export interface ChatMsg {
  id: string
  role: "user" | "agent"
  text: string
  agentText?: string
  routedTo?: string
  interactionSummary?: string
  reflectionSummary?: string
  reflectionGoals?: string[]
  structuredOutput?: Record<string, unknown>
}

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
      if (author && author !== "user") {
        if (!currentTurn.agentsInvolved.includes(author)) {
          currentTurn.agentsInvolved.push(author)
        }
      }

      // Reflection — extract interaction_summary and goals
      if (e.agent_output?.reflection) {
        currentTurn.interactionSummary = e.agent_output.reflection.interaction_summary || undefined
        currentTurn.reflectionSummary = e.agent_output.reflection.summary || undefined
        if (e.agent_output.reflection.new_goals?.length) {
          currentTurn.reflectionGoals = e.agent_output.reflection.new_goals
        }
      }

      // Agent output events — capture the final text and structured output
      if (e.event_class === "agent_output" || e.event_class === "agent_text") {
        if (e.text && author !== "router" && author !== "reflection"
            && author !== "outlaww_text_workflow" && author !== "outlaww_action_workflow") {
          currentTurn.agentText = e.text
          currentTurn.routedTo = author
        }
        // Extract the agent's output from the agent_output dict
        const agentOut = e.agent_output?.[author as keyof AgentOutputDict]
        if (agentOut && author !== "router" && author !== "reflection"
            && author !== "outlaww_text_workflow" && author !== "outlaww_action_workflow") {
          currentTurn.structuredOutput = agentOut as Record<string, unknown>
          currentTurn.routedTo = author
        }
      }
    }
  }

  if (currentTurn) {
    turns.push(currentTurn)
  }

  return turns
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
        // Rehydrate chat from session events
        if (sessRes && sessRes.events.length > 0) {
          const hist = groupEventsIntoTurns(sessRes.events)
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

      // Group response events into a single turn
      const parsedTurns = groupEventsIntoTurns(res.events || [])
      let finalTurn: ChatMsg

      if (parsedTurns.length > 0) {
        finalTurn = {
          ...parsedTurns[0],
          userText: text.trim(),
        }
      } else {
        // Fallback if events list is empty
        finalTurn = {
          id: `agent-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          userText: text.trim(),
          agentText: res.final_text || "(no response)",
          agentsInvolved: res.routed_to ? [res.routed_to] : ["agent"],
          routedTo: res.routed_to,
          structuredOutput: (res.structured_output as Record<string, unknown>) || undefined,
        }
      }

      // Merge reflection fields if returned at top level
      const ref = res.reflection as any
      if (ref) {
        if (ref.interaction_summary) {
          finalTurn.interactionSummary = ref.interaction_summary
        }
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

      const parsedTurns = groupEventsIntoTurns(res.events || [])
      let finalTurn: ChatMsg

      if (parsedTurns.length > 0) {
        finalTurn = {
          ...parsedTurns[0],
          userText: `Action: ${actionName.replace(/_/g, " ")}`,
        }
      } else {
        finalTurn = {
          id: `action-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          userText: `Action: ${actionName.replace(/_/g, " ")}`,
          agentText: res.final_text || `Action "${actionName}" completed`,
          agentsInvolved: res.routed_to ? [res.routed_to] : ["agent"],
          routedTo: res.routed_to,
          structuredOutput: (res.structured_output as Record<string, unknown>) || undefined,
        }
      }

      const ref = res.reflection as any
      if (ref) {
        if (ref.interaction_summary) {
          finalTurn.interactionSummary = ref.interaction_summary
        }
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