import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useSession, type ChatMsg } from "@/hooks/useSession"
import { ReactFlowDiagramView } from "@/components/ReactFlowDiagramView"

import {
  GitBranch,
  Plus,
  Settings,
  Terminal,
  User,
  Bot,
  CheckCircle,
  Send,
  Paperclip,
  Download,
  FileText,
  Zap,
  Loader2,
  MessageCircle,
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
  return (
    <aside className="hidden md:flex w-16 flex-col bg-background border-r border-border z-40 h-full shrink-0">
      <div className="p-4 border-b border-border flex items-center justify-center h-16">
        <span className="font-bold text-xl text-foreground">O</span>
      </div>

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

      <div className="p-4 border-t border-border flex justify-center">
        <button
          title="Settings"
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-all"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
//  Chat Message Bubble
// ---------------------------------------------------------------------------

function ChatMessageBubble({ msg }: { msg: ChatMsg }) {
  if (msg.role === "system") {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Terminal className="w-3.5 h-3.5" />
          <span className="text-[10px] font-mono uppercase tracking-widest">
            System · {msg.timestamp}
          </span>
        </div>
        <div className="bg-background border border-border rounded p-3 text-sm text-foreground font-mono whitespace-pre-wrap">
          {msg.text}
        </div>
      </div>
    )
  }

  if (msg.role === "user") {
    return (
      <div className="flex flex-col gap-1.5 items-end">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-[10px] font-mono uppercase tracking-widest">
            User · {msg.timestamp}
          </span>
          <User className="w-3.5 h-3.5" />
        </div>
        <div className="bg-primary text-primary-foreground rounded-lg rounded-tr-none p-3 text-sm max-w-[85%]">
          {msg.text}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Bot className="w-3.5 h-3.5 text-blue-600" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-blue-600">
          {msg.routedTo || "AI Agent"} · {msg.timestamp}
        </span>
      </div>
      <div className="bg-background border border-border rounded-lg p-3 text-sm text-foreground space-y-3">
        <p className="whitespace-pre-wrap">{msg.text}</p>
        {msg.structuredOutput && (
          <details className="group">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Show structured output
            </summary>
            <pre className="bg-muted p-2 rounded border border-border font-mono text-xs text-muted-foreground mt-2 overflow-x-auto max-h-48 overflow-y-auto">
              {JSON.stringify(msg.structuredOutput, null, 2)}
            </pre>
          </details>
        )}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-xs font-semibold text-foreground">
            Handled by {msg.routedTo || "agent"}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Chat Pane — fixed scroll, same width used by detail panels
// ---------------------------------------------------------------------------

const PANEL_WIDTH = "w-[380px] min-w-[340px] max-w-[480px]"

function ChatPane({
  messages,
  sending,
  onSend,
  onAction,
  actions,
}: {
  messages: ChatMsg[]
  sending: boolean
  onSend: (text: string) => void
  onAction: (name: string) => void
  actions: { name: string; description: string }[]
}) {
  const [input, setInput] = useState("")

  const handleSend = useCallback(() => {
    if (!input.trim() || sending) return
    onSend(input.trim())
    setInput("")
  }, [input, sending, onSend])

  return (
    <section
      className={`flex flex-col bg-background border-r border-border z-40 h-full shrink-0 overflow-hidden ${PANEL_WIDTH}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-border shrink-0">
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

      {/* Messages — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-6 space-y-6">
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
      <div className="p-4 border-t border-border shrink-0">
        <div className="bg-background border border-border rounded-lg p-2 focus-within:border-foreground/30 transition-colors shadow-sm flex flex-col gap-2">
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
              className="h-8 w-8"
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
                className="px-3 py-1.5 text-[11px] uppercase font-semibold border border-border rounded-md bg-background hover:bg-muted transition-colors text-muted-foreground disabled:opacity-50"
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
//  Sidebar Detail Panel — same width as ChatPane
// ---------------------------------------------------------------------------

function SidebarDetailPanel({
  view,
  diagrams,
  docs,
  actions,
  agents,
  selectedDiagramId,
  onSelectDiagram,
  selectedDocId,
  onSelectDoc,
}: {
  view: SidebarView
  diagrams: { id: string; name: string; description?: string }[]
  docs: { id: string; name: string; content?: string }[]
  actions: { name: string; description: string; default_agent: string }[]
  agents: string[]
  selectedDiagramId: string | null
  onSelectDiagram: (id: string) => void
  selectedDocId: string | null
  onSelectDoc: (id: string) => void
}) {
  return (
    <div
      className={`flex flex-col bg-background border-r border-border z-40 h-full shrink-0 overflow-hidden ${PANEL_WIDTH}`}
    >
      {/* Header */}
      <div className="flex items-center px-4 h-16 border-b border-border shrink-0">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
          {view === "diagrams" && "Diagrams"}
          {view === "docs" && "Documents"}
          {view === "actions" && "Actions"}
          {view === "agents" && "Agents"}
        </h3>
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {view === "diagrams" && (
          <div className="space-y-1">
            {diagrams.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">No diagrams yet</p>
            )}
            {diagrams.map((d) => (
              <button
                key={d.id}
                onClick={() => onSelectDiagram(d.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  selectedDiagramId === d.id
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <div className="truncate">{d.name || "Untitled"}</div>
                {d.description && (
                  <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {d.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {view === "docs" && (
          <div className="space-y-1">
            {docs.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">No documents yet</p>
            )}
            {docs.map((d) => (
              <button
                key={d.id}
                onClick={() => onSelectDoc(d.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  selectedDocId === d.id
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <div className="truncate">{d.name || "Untitled"}</div>
              </button>
            ))}
          </div>
        )}

        {view === "actions" && (
          <div className="space-y-1">
            {actions.map((a) => (
              <div key={a.name} className="px-3 py-2 rounded text-sm">
                <div className="text-foreground font-medium">{a.name.replace(/_/g, " ")}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{a.description}</div>
                <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                  agent: {a.default_agent}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "agents" && (
          <div className="space-y-1">
            {agents.map((name) => (
              <div key={name} className="px-3 py-2 rounded text-sm text-foreground font-mono">
                {name}
              </div>
            ))}
          </div>
        )}
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

function TopBar({ title, viewMode, onViewModeChange }: { title: string; viewMode: "canvas" | "code"; onViewModeChange: (v: "canvas" | "code") => void }) {
  return (
    <header className="flex justify-between items-center w-full px-8 h-14 bg-background/80 backdrop-blur-sm border-b border-border z-30 shrink-0">
      <div className="flex items-center gap-8">
        <h2 className="text-sm font-semibold text-foreground">{title || "Untitled"}</h2>
        <nav className="flex items-center gap-6">
          <a
            className={`text-sm cursor-pointer pb-1 transition-colors ${viewMode === "canvas" ? "font-semibold text-foreground border-b-2 border-foreground" : "font-medium text-muted-foreground hover:text-foreground"}`}
            onClick={() => onViewModeChange("canvas")}
          >
            Canvas
          </a>
          <a
            className={`text-sm cursor-pointer pb-1 transition-colors ${viewMode === "code" ? "font-semibold text-foreground border-b-2 border-foreground" : "font-medium text-muted-foreground hover:text-foreground"}`}
            onClick={() => onViewModeChange("code")}
          >
            Code
          </a>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <button className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
          <span className="text-sm font-medium">Export</span>
          <Download className="w-4 h-4" />
        </button>
        <Separator orientation="vertical" className="h-4" />
        <Button variant="default" size="sm" className="uppercase tracking-wider text-xs">
          Share
        </Button>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
//  App
// ---------------------------------------------------------------------------

export default function App() {
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
    // Prefer pre-transformed React Flow data from rfData cache
    const cached = session.rfData[diagram.id]
    if (cached?.nodes?.length) return cached
    // Fallback: extract from graph directly (clean model uses snake_case)
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

  const showChat = session.sidebarView === "chat"
  const showDetail = session.sidebarView !== "chat"

  return (
    <div className="h-screen w-full overflow-hidden flex font-sans antialiased bg-background">
      <IconRail
        activeView={session.sidebarView}
        onViewChange={session.setSidebarView}
        diagramCount={session.diagrams.length}
        docCount={session.markdownDocs.length}
      />
      <main className="flex-1 flex h-full relative overflow-hidden">
        {/* Only ONE panel shows — chat OR details, never both */}
        {showChat && (
          <ChatPane
            messages={session.messages}
            sending={session.sending}
            onSend={session.sendMessage}
            onAction={session.runAction}
            actions={session.actions}
          />
        )}
        {showDetail && (
          <SidebarDetailPanel
            view={session.sidebarView}
            diagrams={session.diagrams}
            docs={session.markdownDocs}
            actions={session.actions}
            agents={session.agents}
            selectedDiagramId={session.selectedDiagramId}
            onSelectDiagram={session.setSelectedDiagramId}
            selectedDocId={session.selectedDocId}
            onSelectDoc={session.setSelectedDocId}
          />
        )}
        <section className="flex-1 flex flex-col h-full relative overflow-hidden">
          <TopBar title={projectName} viewMode={viewMode} onViewModeChange={setViewMode} />
          {selectedDoc ? (
            <MarkdownViewer doc={selectedDoc} />
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
      </main>
    </div>
  )
}