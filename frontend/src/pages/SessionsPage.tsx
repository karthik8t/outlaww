import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import * as api from "@/lib/api"
import { MessageCircle, Plus, Trash2, Clock, ExternalLink } from "lucide-react"

function formatTime(ts: number): string {
  if (!ts) return "—"
  const d = new Date(ts * 1000)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString()
}

export default function SessionsPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<api.SessionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listSessions()
      setSessions(res.sessions.sort((a, b) => b.last_update_time - a.last_update_time))
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleCreate = useCallback(async () => {
    setCreating(true)
    try {
      const res = await api.createSession()
      navigate(`/session/${encodeURIComponent(res.session_id)}`)
    } catch (err) {
      console.error("create session error:", err)
      setCreating(false)
    }
  }, [navigate])

  const handleDelete = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleting(sessionId)
    try {
      await api.deleteSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId))
    } catch (err) {
      console.error("delete session error:", err)
    }
    setDeleting(null)
  }, [])

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col font-sans antialiased bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-8 h-16 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="font-bold text-xl text-foreground cursor-pointer">O</button>
          <span className="text-sm font-semibold text-foreground uppercase tracking-widest">
            Sessions
          </span>
        </div>
        <Button onClick={handleCreate} disabled={creating}>
          <Plus className="w-4 h-4" />
          {creating ? "Creating..." : "New Session"}
        </Button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-4xl mx-auto p-8">
          {loading ? (
            <div className="text-center text-muted-foreground text-sm py-24">
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-24 space-y-4">
              <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">No sessions yet</p>
              <Button onClick={handleCreate} disabled={creating}>
                <Plus className="w-4 h-4" />
                Create your first session
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.session_id}
                  onClick={() => navigate(`/session/${encodeURIComponent(s.session_id)}`)}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-left group cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/session/${encodeURIComponent(s.session_id)}`) }}
                >
                  <MessageCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {s.session_id.slice(0, 16)}...
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {s.session_id.slice(0, 8)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatTime(s.last_update_time)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-muted-foreground mr-1">Open</span>
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.session_id, e); }}
                    disabled={deleting === s.session_id}
                    className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
