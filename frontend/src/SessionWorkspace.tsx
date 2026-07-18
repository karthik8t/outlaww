import { useCallback, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useSession, type ChatMsg } from "@/hooks/useSession"
import { ReactFlowDiagramView } from "@/components/ReactFlowDiagramView"
import { useTheme } from "@/components/theme-provider"
import {
  GitBranch,
  Plus,
  Settings,
  Terminal,
  Bot,
  Send,
  Paperclip,
  Download,
  FileText,
  Zap,
  Loader2,
  MessageCircle,
  Lightbulb,
  Search,
  AlertTriangle,
  Brain,
  Compass,
  CheckCircle2,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react"


// ---------------------------------------------------------------------------
//  Sidebar view type
// ---------------------------------------------------------------------------

type SidebarView = "chat" | "diagrams" | "docs" | "actions" | "agents"

interface SidebarItemDef {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  view: SidebarView
}

const SIDEBAR_ITEMS: SidebarItemDef[] = [
  { id: "chat", label: "Chat", icon: MessageCircle, view: "chat" },
  { id: "diagrams", label: "Diagrams", icon: GitBranch, view: "diagrams" },
  { id: "docs", label: "Documents", icon: FileText, view: "docs" },
  { id: "actions", label: "Actions", icon: Zap, view: "actions" },
  { id: "agents", label: "Agents", icon: Bot, view: "agents" },
]

// ---------------------------------------------------------------------------
//  Icon Rail
// ---------------------------------------------------------------------------

function IconRail({
  activeView,
  onViewChange,
  diagramCount,
  docCount,
}: {
  activeView: SidebarView
  onViewChange: (v: SidebarView) => void
  diagramCount: number
  docCount: number
}) {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <aside className="hidden md:flex w-16 flex-col bg-background border-r border-border z-40 h-full shrink-0">
      <button
        onClick={() => navigate("/")}
        className="w-full p-4 border-b border-border flex items-center justify-center h-16 cursor-pointer"
      >
        <span className="font-bold text-xl text-foreground">O</span>
      </button>

      <div className="py-6 flex-1 flex flex-col items-center gap-3 overflow-y-auto no-scrollbar">
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.view
          const badge =
            item.view === "diagrams"
              ? diagramCount
              : item.view === "docs"
                ? docCount
                : 0
          return (
            <button
              key={item.id}
              title={item.label}
              onClick={() => onViewChange(item.view)}
              className={`relative p-2 rounded-lg transition-all border ${
                isActive
                  ? "bg-muted text-foreground shadow-sm border-border"
                  : "text-muted-foreground hover:bg-muted border-transparent"
              }`}
            >
              <Icon className="w-5 h-5" />
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-foreground text-background text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          )
        })}
        <button
          title="New"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors mt-2"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 border-t border-border flex flex-col items-center gap-3">
        <button
          title={`${theme === "dark" ? "Light" : "Dark"} mode`}
          onClick={toggleTheme}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-all cursor-pointer"
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button
          title="Settings"
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-all cursor-pointer"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
//  Agent output summary components
// ---------------------------------------------------------------------------

function DiagramSummary({ output }: { output: Record<string, unknown> }) {
  const meta = output.metadata as Record<string, unknown> | undefined
  const nodes = output.nodes as Array<any> | undefined
  return (
    <details className="group pt-1">
      <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none list-none flex items-center gap-1">
        <span className="inline-block transition-transform group-open:rotate-90">▶</span>
        <GitBranch className="w-3 h-3 inline" />
        {meta?.label ? <>Diagram: <span className="font-medium">{String(meta.label)}</span></> : "Diagram"}
        {nodes?.length ? <> · {nodes.length} {nodes.length === 1 ? "node" : "nodes"}</> : null}
      </summary>
      <div className="mt-2 pl-4 space-y-1.5 border-l border-border/60">
        {nodes && nodes.map((node: any, idx) => (
          <div key={idx} className="text-xs">
            <span className="font-medium text-foreground">{node.data?.label || node.id}</span>
            {node.data?.subtitle && <span className="text-muted-foreground text-[10px] ml-1">({node.data.subtitle})</span>}
            {node.purpose && <p className="text-[11px] text-muted-foreground mt-0.5">{node.purpose}</p>}
          </div>
        ))}
      </div>
    </details>
  )
}

function CreateMarkdownSummary({ output }: { output: Record<string, unknown> }) {
  const sections = output.sections as Array<any> | undefined
  return (
    <details className="group pt-1">
      <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none list-none flex items-center gap-1">
        <span className="inline-block transition-transform group-open:rotate-90">▶</span>
        <FileText className="w-3 h-3 inline" />
        Created document{output.title ? <>: <span className="font-medium">{String(output.title)}</span></> : null}
        {sections?.length ? <> · {sections.length} {sections.length === 1 ? "section" : "sections"}</> : null}
      </summary>
      <div className="mt-2 pl-4 space-y-1.5 border-l border-border/60">
        {!!output.description && (
          <p className="text-xs text-foreground italic mb-1">{String(output.description)}</p>
        )}
        {sections && sections.map((sec: any, idx) => (
          <div key={idx} className="text-xs">
            <span className="font-medium text-foreground"># {sec.title || "Section"}</span>
            {sec.description && <p className="text-[11px] text-muted-foreground mt-0.5">{sec.description}</p>}
          </div>
        ))}
      </div>
    </details>
  )
}

function EditMarkdownSummary({ output }: { output: Record<string, unknown> }) {
  const edits = output.edits as Array<any> | undefined
  return (
    <details className="group pt-1">
      <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none list-none flex items-center gap-1">
        <span className="inline-block transition-transform group-open:rotate-90">▶</span>
        <FileText className="w-3 h-3 inline" />
        Edited document · {edits?.length ?? 0} {(edits?.length ?? 0) === 1 ? "change" : "changes"}
      </summary>
      <div className="mt-2 pl-4 space-y-1.5 border-l border-border/60">
        {!!output.reasoning && (
          <p className="text-xs text-muted-foreground font-medium mb-1.5">{String(output.reasoning)}</p>
        )}
        {edits && edits.map((edit: any, idx) => (
          <div key={idx} className="text-xs text-muted-foreground">
            <span className="font-mono text-[9px] bg-muted px-1 py-0.5 uppercase border border-border">{edit.type || "edit"}</span>
            <span className="ml-1.5 text-foreground">{edit.title || edit.section_title || ""}</span>
            {edit.description && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{edit.description}</p>}
          </div>
        ))}
      </div>
    </details>
  )
}

function ExplainerSummary({ output }: { output: Record<string, unknown> }) {
  const keyPoints = output.key_points as string[] | undefined
  return (
    <details className="group pt-1" open>
      <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none list-none flex items-center gap-1">
        <span className="inline-block transition-transform group-open:rotate-90">▶</span>
        <Lightbulb className="w-3 h-3 inline" />
        Explanation · {keyPoints?.length ?? 0} {(keyPoints?.length ?? 0) === 1 ? "key point" : "key points"}
      </summary>
      {!!output.explanation && (
        <p className="text-xs text-foreground mt-1.5 pl-4 leading-relaxed">{String(output.explanation)}</p>
      )}
      {keyPoints?.length ? (
        <ul className="mt-1.5 pl-6 space-y-1">
          {keyPoints.map((pt, i) => (
            <li key={i} className="text-xs text-muted-foreground list-disc">{pt}</li>
          ))}
        </ul>
      ) : null}
    </details>
  )
}

function GapSuggestionSummary({ output }: { output: Record<string, unknown> }) {
  const dg = (output.diagram_gaps as Array<unknown> | undefined)?.length ?? 0
  const dg2 = (output.documentation_gaps as Array<unknown> | undefined)?.length ?? 0
  const cn = (output.concerns as Array<unknown> | undefined)?.length ?? 0
  const sg = (output.suggestions as Array<unknown> | undefined)?.length ?? 0
  return (
    <details className="group pt-1">
      <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none list-none flex items-center gap-1">
        <span className="inline-block transition-transform group-open:rotate-90">▶</span>
        <AlertTriangle className="w-3 h-3 inline" />
        Analysis
        {dg > 0 && <> · {dg} diagram {dg === 1 ? "gap" : "gaps"}</>}
        {dg2 > 0 && <> · {dg2} doc {dg2 === 1 ? "gap" : "gaps"}</>}
        {cn > 0 && <> · {cn} {cn === 1 ? "concern" : "concerns"}</>}
        {sg > 0 && <> · {sg} {sg === 1 ? "suggestion" : "suggestions"}</>}
      </summary>
      <div className="mt-2 pl-4 space-y-3 border-l border-border/60">
        {!!output.concerns && (output.concerns as any[]).length > 0 && (
          <div>
            <span className="text-[9px] font-mono uppercase tracking-wider font-semibold text-rose-500 block mb-1">Concerns</span>
            <ul className="list-disc pl-4 space-y-1">
              {(output.concerns as any[]).map((c, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{c.title || c.concern}</span>: {c.description || c.impact}
                </li>
              ))}
            </ul>
          </div>
        )}
        {!!output.suggestions && (output.suggestions as any[]).length > 0 && (
          <div>
            <span className="text-[9px] font-mono uppercase tracking-wider font-semibold text-emerald-500 block mb-1">Suggestions</span>
            <ul className="list-disc pl-4 space-y-1">
              {(output.suggestions as any[]).map((s, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{s.title || s.suggestion}</span>: {s.description || s.benefit}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  )
}

function ResearchSummary({ output }: { output: Record<string, unknown> }) {
  const findings = output.findings as Array<unknown> | undefined
  const confidence = (output.confidence as number) || 0
  return (
    <details className="group pt-1" open>
      <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none list-none flex items-center gap-1">
        <span className="inline-block transition-transform group-open:rotate-90">▶</span>
        <Search className="w-3 h-3 inline" />
        Research · {findings?.length ?? 0} {(findings?.length ?? 0) === 1 ? "finding" : "findings"}
        {confidence > 0 && <> · {Math.round(confidence * 100)}% confidence</>}
      </summary>
      {!!output.summary && (
        <p className="text-xs text-foreground mt-1.5 pl-4 leading-relaxed">{String(output.summary)}</p>
      )}
      {!!output.recommendation && (
        <div className="mt-1.5 pl-4">
          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">Recommendation</span>
          <p className="text-xs text-foreground mt-0.5">{String(output.recommendation)}</p>
        </div>
      )}
    </details>
  )
}

const _AGENT_RENDERERS: Record<string, (o: Record<string, unknown>) => React.ReactNode> = {
  create_diagram: (o) => <DiagramSummary output={o} />,
  edit_diagram: (o) => <DiagramSummary output={o} />,
  patch_diagram: (o) => <DiagramSummary output={o} />,
  create_markdown: (o) => <CreateMarkdownSummary output={o} />,
  edit_markdown: (o) => <EditMarkdownSummary output={o} />,
  explainer: (o) => <ExplainerSummary output={o} />,
  gap_suggestion: (o) => <GapSuggestionSummary output={o} />,
  research: (o) => <ResearchSummary output={o} />,
}

function AgentOutputRenderer({ output, agent }: { output?: Record<string, unknown>; agent?: string }) {
  if (!output || !agent) return null

  const agentKey = agent.replace(/^(outlaww_|flow_|c4_)/, "").replace(/_workflow$/, "")
  const renderer = _AGENT_RENDERERS[agentKey]
  if (renderer) return renderer(output)

  return (
    <details className="group pt-1">
      <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none list-none flex items-center gap-1">
        <span className="inline-block transition-transform group-open:rotate-90">▶</span>
        Structured output
      </summary>
      <pre className="bg-muted p-3 rounded-lg border border-border font-mono text-[11px] text-foreground mt-2.5 overflow-x-auto max-h-48 overflow-y-auto">
        {JSON.stringify(output, null, 2)}
      </pre>
    </details>
  )
}

// ---------------------------------------------------------------------------
//  Helpers & Stepper for Chat Message Bubble
// ---------------------------------------------------------------------------

function isJsonString(str?: string): boolean {
  if (!str) return false
  const trimmed = str.trim()
  return (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))
}

function AgentWorkflowPipeline({
  agentsInvolved,
  userText,
  isError,
}: {
  agentsInvolved: string[]
  userText?: string
  isError?: boolean
}) {
  const isPredefinedAction = userText?.startsWith("Action:")
  
  const steps: Array<{
    id: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    color: string
    bgColor: string
    borderColor: string
  }> = []

  // 1. Router / Action Step
  if (!isPredefinedAction) {
    steps.push({
      id: "router",
      label: "Router",
      icon: Compass,
      color: "text-blue-700 dark:text-blue-300",
      bgColor: "bg-blue-50/80 dark:bg-blue-950/20",
      borderColor: "border-blue-200 dark:border-blue-900/50",
    })
  } else {
    steps.push({
      id: "action-trigger",
      label: "Action",
      icon: Zap,
      color: "text-amber-700 dark:text-amber-300",
      bgColor: "bg-amber-50/80 dark:bg-amber-950/20",
      borderColor: "border-amber-200 dark:border-amber-900/50",
    })
  }

  // 2. Dispatched Agents
  agentsInvolved.forEach((agent) => {
    const cleanName = agent.replace(/^(outlaww_|flow_|c4_)/, "").replace(/_workflow$/, "")
    let label = cleanName.replace(/_/g, " ")
    label = label.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")

    let icon = Bot
    let color = "text-slate-700 dark:text-slate-300"
    let bgColor = "bg-slate-50/80 dark:bg-slate-900/30"
    let borderColor = "border-slate-200 dark:border-slate-800"

    if (cleanName.includes("diagram")) {
      icon = GitBranch
      color = "text-emerald-700 dark:text-emerald-300"
      bgColor = "bg-emerald-50/80 dark:bg-emerald-950/20"
      borderColor = "border-emerald-200 dark:border-emerald-900/50"
    } else if (cleanName.includes("markdown")) {
      icon = FileText
      color = "text-orange-700 dark:text-orange-300"
      bgColor = "bg-orange-50/80 dark:bg-orange-950/20"
      borderColor = "border-orange-200 dark:border-orange-900/50"
    } else if (cleanName === "explainer") {
      icon = Lightbulb
      color = "text-yellow-700 dark:text-yellow-300"
      bgColor = "bg-yellow-50/80 dark:bg-yellow-950/20"
      borderColor = "border-yellow-200 dark:border-yellow-900/50"
    } else if (cleanName === "gap_suggestion") {
      icon = AlertTriangle
      color = "text-rose-700 dark:text-rose-300"
      bgColor = "bg-rose-50/80 dark:bg-rose-950/20"
      borderColor = "border-rose-200 dark:border-rose-900/50"
    } else if (cleanName === "research") {
      icon = Search
      color = "text-cyan-700 dark:text-cyan-300"
      bgColor = "bg-cyan-50/80 dark:bg-cyan-950/20"
      borderColor = "border-cyan-200 dark:border-cyan-900/50"
    }

    steps.push({
      id: agent,
      label,
      icon,
      color,
      bgColor,
      borderColor,
    })
  })

  // 3. Reflection Step
  if (!isError) {
    steps.push({
      id: "reflection",
      label: "Reflection",
      icon: Brain,
      color: "text-purple-700 dark:text-purple-300",
      bgColor: "bg-purple-50/80 dark:bg-purple-950/20",
      borderColor: "border-purple-200 dark:border-purple-900/50",
    })
  }

  return (
    <div className="flex items-center gap-1.5 px-1 py-1 w-full overflow-x-auto no-scrollbar flex-nowrap whitespace-nowrap">
      {steps.map((step, idx) => {
        const Icon = step.icon
        return (
          <div key={step.id} className="flex items-center gap-1.5 shrink-0 flex-nowrap">
            {idx > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />}
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 border rounded-sm text-[9px] font-semibold uppercase tracking-wider font-mono shadow-none transition-colors ${step.bgColor} ${step.borderColor} ${step.color}`}
            >
              <Icon className="w-2.5 h-2.5 shrink-0" />
              <span>{step.label}</span>
              {step.id === "reflection" && <CheckCircle2 className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400 shrink-0" />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Chat Message Bubble — redesigned
// ---------------------------------------------------------------------------

function ChatMessageBubble({ msg }: { msg: ChatMsg }) {
  if (msg.isError) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-red-600">
          <Terminal className="w-3.5 h-3.5" />
          <span className="text-[10px] font-mono uppercase tracking-widest font-semibold">
            System Error · {msg.timestamp}
          </span>
        </div>
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-3 text-sm text-red-850 dark:text-red-305 font-mono whitespace-pre-wrap">
          {msg.agentText}
        </div>
      </div>
    )
  }

  const hasStructuredOutputs = msg.structuredOutputs && msg.structuredOutputs.length > 0
  const isAgentTextJson = isJsonString(msg.agentText)

  const displaySummary = msg.agentResponse || undefined
  const reflectionSummary = msg.reflectionSummary || undefined
  const reflectionGoals = msg.reflectionGoals || undefined

  // Show "Show full response" only if there are no structured output renderers to show it,
  // it is not a JSON string, and it differs from the primary response summary.
  const showCollapsible = msg.agentText && 
    msg.agentText !== msg.agentResponse && 
    msg.agentText !== displaySummary &&
    !isAgentTextJson && 
    !hasStructuredOutputs

  return (
    <div className="flex flex-col gap-4">
      {/* ── User message: right-aligned ── */}
      {msg.userText && (
        <div className="flex justify-end">
          <div className="bg-primary text-primary-foreground rounded-md px-4 py-2.5 text-sm max-w-[80%] border border-primary/20 shadow-none">
            {msg.userText}
          </div>
        </div>
      )}

      {/* ── Agent response ── */}
      {(displaySummary || reflectionSummary || msg.agentText || hasStructuredOutputs) && (
        <div className="flex flex-col gap-1.5">
          {/* Stepper visual workflow of agents involved */}
          <AgentWorkflowPipeline 
            agentsInvolved={msg.agentsInvolved} 
            userText={msg.userText}
            isError={msg.isError}
          />

          {/* Response card */}
          <div className="bg-background border border-border rounded-lg p-4 shadow-none space-y-3">
            {/* Primary response text (interaction_summary) in a nice styled callout */}
            {displaySummary && (
              <div className="bg-muted/40 border-l-2 border-primary/40 px-3 py-2 rounded-sm text-sm text-foreground font-semibold leading-relaxed">
                {displaySummary}
              </div>
            )}

            {/* Reflection broader summary or fallback agentText */}
            {reflectionSummary ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {reflectionSummary}
              </p>
            ) : (
              msg.agentText && !isAgentTextJson && (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {msg.agentText}
                </p>
              )
            )}

            {/* Collapsible full dispatch text if relevant */}
            {showCollapsible && (
              <details className="group">
                <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none list-none flex items-center gap-1">
                  <span className="inline-block transition-transform group-open:rotate-90">▶</span>
                  Show full response
                </summary>
                <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans mt-2 pl-3 border-l-2 border-border">
                  {msg.agentText}
                </div>
              </details>
            )}

            {/* Structured outputs from each agent wrapped in elegant cards */}
            {hasStructuredOutputs && (
              <div className="space-y-3 pt-3 border-t border-border/60">
                <span className="text-[9px] font-mono uppercase tracking-wider font-semibold text-muted-foreground/80 block">
                  Artifacts & Explanations
                </span>
                <div className="space-y-2">
                  {msg.structuredOutputs!.map((so, i) => (
                    <div key={i} className="p-3 rounded-md bg-muted/20 border border-border/60 hover:bg-muted/30 transition-colors">
                      <AgentOutputRenderer output={so.output} agent={so.agent} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reflection goals styled as modern checklist items */}
            {reflectionGoals && reflectionGoals.length > 0 && (
              <div className="pt-3 border-t border-border/60">
                <span className="text-[9px] font-mono uppercase tracking-wider font-semibold text-muted-foreground block mb-2">
                  Next Steps
                </span>
                <div className="space-y-1.5">
                  {reflectionGoals.map((goal, index) => (
                    <div key={index} className="flex items-start gap-2 group/goal">
                      <span className="mt-2 w-1.5 h-1.5 rounded-sm bg-primary/60 shrink-0 transition-colors group-hover/goal:bg-primary" />
                      <span className="text-xs text-muted-foreground leading-tight group-hover/goal:text-foreground transition-colors">
                        {goal}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Chat Pane
// ---------------------------------------------------------------------------

const PANEL_WIDTH = "w-[380px] min-w-[340px] max-w-[480px]"

function ChatPane({
  messages,
  sending,
  onSend,
  onAction,
  actions,
  fullWidth = false,
}: {
  messages: ChatMsg[]
  sending: boolean
  onSend: (text: string) => void
  onAction: (name: string) => void
  actions: { name: string; description: string }[]
  fullWidth?: boolean
}) {
  const [input, setInput] = useState("")

  const handleSend = useCallback(() => {
    if (!input.trim() || sending) return
    onSend(input.trim())
    setInput("")
  }, [input, sending, onSend])

  return (
    <section
      className={`flex flex-col bg-background z-40 h-full overflow-hidden ${
        fullWidth ? "flex-1 w-full" : `border-r border-border shrink-0 ${PANEL_WIDTH}`
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between h-16 border-b border-border shrink-0 ${
        fullWidth ? "px-8 max-w-4xl mx-auto w-full" : "px-4"
      }`}>
        <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
          Chat & History
        </h3>
        <div className="flex bg-muted rounded-md p-0.5">
          <button className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider rounded bg-background shadow-sm text-foreground">
            Chat
          </button>
          <button className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider rounded text-muted-foreground hover:text-foreground transition-colors">
            Log
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className={`py-6 space-y-6 ${
          fullWidth ? "max-w-4xl mx-auto w-full px-8" : "p-6"
        }`}>
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-12">
              Start a conversation to build your architecture.
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} msg={msg} />
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className={`border-t border-border shrink-0 py-4 ${
        fullWidth ? "max-w-4xl mx-auto w-full px-8 pb-6" : "p-4"
      }`}>
        <div className="bg-background border border-border rounded-lg p-2 focus-within:border-foreground/30 transition-colors shadow-none flex flex-col gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Instruct the AI to modify the architecture..."
            className="min-h-[60px] bg-transparent border-none focus-visible:ring-0 resize-none text-sm p-2"
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <div className="flex items-center justify-between px-2 pb-1">
            <div className="flex gap-2">
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <Paperclip className="w-[18px] h-[18px]" />
              </button>
            </div>
            <Button
              size="icon"
              className="h-8 w-8 rounded-sm"
              onClick={handleSend}
              disabled={sending || !input.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            {actions.slice(0, 5).map((a) => (
              <button
                key={a.name}
                onClick={() => onAction(a.name)}
                disabled={sending}
                title={a.description}
                className="px-3 py-1.5 text-[11px] uppercase font-semibold border border-border rounded-sm bg-background hover:bg-muted transition-colors text-muted-foreground disabled:opacity-50"
              >
                {a.name.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        )}
        <div className="text-center mt-2 text-[10px] text-muted-foreground font-mono">
          Ctrl+Enter to send
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
//  Sidebar Detail Panel
// ---------------------------------------------------------------------------

const DiagramsEmptyState = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background text-center">
    <div className="border border-border p-6 max-w-md bg-muted/10 rounded-lg">
      <GitBranch className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-1">No Diagram Active</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Select a diagram from the dropdown at the top, or use the Chat to ask the AI to design a new architecture diagram.
      </p>
    </div>
  </div>
)

const DocsEmptyState = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background text-center">
    <div className="border border-border p-6 max-w-md bg-muted/10 rounded-lg">
      <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-1">No Document Active</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Select a document from the dropdown at the top, or use the Chat to ask the AI to write technical documentation.
      </p>
    </div>
  </div>
)

function ActionsPage({
  actions,
  sending,
  onAction,
}: {
  actions: { name: string; description: string; default_agent: string }[]
  sending: boolean
  onAction: (name: string) => void
}) {
  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <header className="px-8 h-16 border-b border-border flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
          Available Actions
        </h3>
      </header>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {actions.map((a) => (
            <div
              key={a.name}
              className="border border-border p-4 bg-muted/10 hover:bg-muted/20 transition-all flex flex-col justify-between rounded-lg"
            >
              <div>
                <h4 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1">
                  {a.name.replace(/_/g, " ")}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                  {a.description}
                </p>
              </div>
              <div className="flex items-center justify-between mt-auto">
                <span className="text-[10px] font-mono text-muted-foreground/80">
                  agent: {a.default_agent}
                </span>
                <Button
                  size="sm"
                  onClick={() => onAction(a.name)}
                  disabled={sending}
                  className="uppercase tracking-wider text-[10px] font-semibold h-7 rounded-sm border border-primary px-3"
                >
                  Trigger Action
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AgentsPage({ agents }: { agents: string[] }) {
  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <header className="px-8 h-16 border-b border-border flex items-center shrink-0">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
          AI Dispatched Agents
        </h3>
      </header>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((name) => {
            const cleanName = name.replace(/^(outlaww_|flow_|c4_)/, "").replace(/_workflow$/, "")
            let label = cleanName.replace(/_/g, " ")
            label = label.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
            
            return (
              <div key={name} className="border border-border p-4 bg-muted/10 rounded-lg flex items-start gap-3">
                <div className="p-2 border border-border bg-background rounded-sm text-primary">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1">
                    {label}
                  </h4>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    {name}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Markdown Viewer
// ---------------------------------------------------------------------------

function MarkdownViewer({
  doc,
}: {
  doc: { name: string; content: string; frontmatter?: Record<string, unknown> }
}) {
  return (
    <div className="flex-1 overflow-y-auto p-8 bg-background">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">{doc.name}</h1>
        {doc.frontmatter && (
          <pre className="text-xs text-muted-foreground bg-muted p-3 rounded mb-6 font-mono overflow-x-auto">
            {JSON.stringify(doc.frontmatter, null, 2)}
          </pre>
        )}
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-foreground">
          {doc.content}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Top Bar
// ---------------------------------------------------------------------------

function TopBar({
  title,
  viewMode,
  onViewModeChange,
  items,
  selectedId,
  onSelect,
  placeholder = "Select item",
  showViewToggle = false,
}: {
  title: string
  viewMode?: "canvas" | "code"
  onViewModeChange?: (v: "canvas" | "code") => void
  items?: { id: string; name: string }[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  placeholder?: string
  showViewToggle?: boolean
}) {
  return (
    <header className="flex justify-between items-center w-full px-8 h-14 bg-background/80 backdrop-blur-sm border-b border-border z-30 shrink-0">
      <div className="flex items-center gap-6">
        {items && items.length > 0 && onSelect ? (
          <select
            value={selectedId || ""}
            onChange={(e) => onSelect(e.target.value)}
            className="bg-background border border-border px-3 py-1 rounded-sm text-xs font-bold uppercase tracking-wider text-foreground focus:outline-none focus:ring-0 cursor-pointer"
          >
            <option value="" disabled>{placeholder}</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name || "Untitled"}
              </option>
            ))}
          </select>
        ) : (
          <h2 className="text-sm font-semibold text-foreground">{title || "Untitled"}</h2>
        )}

        {showViewToggle && onViewModeChange && viewMode && (
          <nav className="flex items-center gap-6">
            <button
              className={`text-xs uppercase tracking-wider cursor-pointer pb-1 transition-colors ${
                viewMode === "canvas"
                  ? "font-semibold text-foreground border-b border-foreground"
                  : "font-medium text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onViewModeChange("canvas")}
            >
              Canvas
            </button>
            <button
              className={`text-xs uppercase tracking-wider cursor-pointer pb-1 transition-colors ${
                viewMode === "code"
                  ? "font-semibold text-foreground border-b border-foreground"
                  : "font-medium text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onViewModeChange("code")}
            >
              Code
            </button>
          </nav>
        )}
      </div>
      <div className="flex items-center gap-4">
        <button className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider font-semibold">Export</span>
          <Download className="w-4 h-4" />
        </button>
        <Separator orientation="vertical" className="h-4" />
        <Button variant="default" size="sm" className="uppercase tracking-wider text-xs rounded-sm border border-primary">
          Share
        </Button>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
//  SessionWorkspace
// ---------------------------------------------------------------------------

export default function SessionWorkspace() {
  const session = useSession()
  const [viewMode, setViewMode] = useState<"canvas" | "code">("canvas")

  const selectedDiagram = useMemo(
    () => session.diagrams.find((d) => d.id === session.selectedDiagramId) || null,
    [session.diagrams, session.selectedDiagramId],
  )

  const selectedDoc = useMemo(
    () => session.markdownDocs.find((d) => d.id === session.selectedDocId) || null,
    [session.markdownDocs, session.selectedDocId],
  )

  const projectName = useMemo(() => {
    if (selectedDiagram?.name) return selectedDiagram.name
    if (selectedDoc?.name) return selectedDoc.name
    return "Untitled"
  }, [selectedDiagram, selectedDoc])

  const getDiagramData = useCallback((diagram: any) => {
    if (!diagram) return undefined
    const cached = session.rfData[diagram.id]
    if (cached?.nodes?.length) return cached
    if (diagram.graph?.nodes?.length) {
      return {
        nodes: diagram.graph.nodes,
        edges: diagram.graph.edges || [],
        metadata: {
          layoutDirection: diagram.graph.metadata?.layout_direction ?? "LR"
        }
      }
    }
    return undefined
  }, [session.rfData])

  const activeView = session.sidebarView

  return (
    <div className="h-screen w-full overflow-hidden flex font-sans antialiased bg-background">
      <IconRail
        activeView={activeView}
        onViewChange={session.setSidebarView}
        diagramCount={session.diagrams.length}
        docCount={session.markdownDocs.length}
      />
      <main className="flex-1 flex h-full relative overflow-hidden bg-background">
        {activeView === "chat" && (
          <div className="flex-1 flex justify-center h-full overflow-hidden">
            <ChatPane
              messages={session.messages}
              sending={session.sending}
              onSend={session.sendMessage}
              onAction={session.runAction}
              actions={session.actions}
              fullWidth
            />
          </div>
        )}

        {activeView === "diagrams" && (
          <section className="flex-1 flex flex-col h-full relative overflow-hidden">
            <TopBar
              title={projectName}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              items={session.diagrams}
              selectedId={session.selectedDiagramId}
              onSelect={session.setSelectedDiagramId}
              placeholder="Select Diagram"
              showViewToggle
            />
            {session.diagrams.length === 0 || !session.selectedDiagramId ? (
              <DiagramsEmptyState />
            ) : viewMode === "code" ? (
              <div className="flex-1 overflow-auto p-6 bg-background">
                <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
                  {JSON.stringify(getDiagramData(selectedDiagram), null, 2)}
                </pre>
              </div>
            ) : (
              <ReactFlowDiagramView
                diagramData={getDiagramData(selectedDiagram)}
                diagramId={selectedDiagram?.id}
                onDiagramChange={(nodes, edges) => {
                  if (selectedDiagram) {
                    console.log("Diagram changed:", { nodes, edges })
                  }
                }}
                fetchDiagramData={session.fetchDiagramSource}
              />
            )}
          </section>
        )}

        {activeView === "docs" && (
          <section className="flex-1 flex flex-col h-full relative overflow-hidden">
            <TopBar
              title={projectName}
              items={session.markdownDocs}
              selectedId={session.selectedDocId}
              onSelect={session.setSelectedDocId}
              placeholder="Select Document"
            />
            {session.markdownDocs.length === 0 || !session.selectedDocId || !selectedDoc ? (
              <DocsEmptyState />
            ) : (
              <MarkdownViewer doc={selectedDoc} />
            )}
          </section>
        )}

        {activeView === "actions" && (
          <ActionsPage
            actions={session.actions}
            sending={session.sending}
            onAction={(name) => {
              session.runAction(name)
              session.setSidebarView("chat")
            }}
          />
        )}

        {activeView === "agents" && (
          <AgentsPage agents={session.agents} />
        )}
      </main>
    </div>
  )
}