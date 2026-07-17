/**
 * Cross-device Clipboard - Paste on one device, copy on another.
 * Uses a temporary backend store with short-lived IDs.
 */
import { useCallback, useEffect, useState } from "react"
import { Copy, Clipboard, Clock, Trash2, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { BASE_URL } from "@/lib/api"

interface ClipboardItem {
  id: string
  content: string
  expires_at: number
  created_at: number
}

interface CreateResponse {
  id: string
  content: string
  expires_at: number
  created_at: number
}

export function CrossDeviceClipboard() {
  const [content, setContent] = useState("")
  const [items, setItems] = useState<ClipboardItem[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Clear message after 3s
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 3000)
      return () => clearTimeout(t)
    }
  }, [message])

  const showMessage = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text })
  }, [])

  const copyToClipboard = useCallback(async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showMessage("success", "Copied to clipboard!")
      if (id) setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      showMessage("error", "Failed to copy")
    }
  }, [showMessage])

  const createClipboard = useCallback(async () => {
    if (!content.trim()) {
      showMessage("error", "Enter some text first")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${BASE_URL}/clipboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      })
      if (!res.ok) throw new Error("Failed to create")
      const data: CreateResponse = await res.json()
      showMessage("success", `Created! Share ID: ${data.id}`)
      setContent("")
    } catch {
      showMessage("error", "Failed to create clipboard entry")
    } finally {
      setLoading(false)
    }
  }, [content, showMessage])

  const fetchById = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${BASE_URL}/clipboard/${id}`)
      if (!res.ok) throw new Error("Not found or expired")
      const data: ClipboardItem = await res.json()
      setItems(prev => {
        if (prev.some(i => i.id === data.id)) return prev
        return [data, ...prev].slice(0, 10)
      })
      copyToClipboard(data.content, data.id)
      showMessage("success", `Loaded and copied: ${data.id}`)
    } catch {
      showMessage("error", "Clipboard not found or expired")
    } finally {
      setLoading(false)
    }
  }, [copyToClipboard, showMessage])

  const deleteItem = useCallback(async (id: string) => {
    try {
      await fetch(`${BASE_URL}/clipboard/${id}`, { method: "DELETE" })
      setItems(prev => prev.filter(i => i.id !== id))
      showMessage("success", "Deleted")
    } catch {
      showMessage("error", "Failed to delete")
    }
  }, [showMessage])

  const formatTime = (ts: number) => {
    const diff = Math.max(0, Math.floor((ts - Date.now()) / 1000))
    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `${Math.floor(diff / 60)}m`
    return `${Math.floor(diff / 3600)}h`
  }

  const shareUrl = `${window.location.origin}${window.location.pathname}#`

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Clipboard className="w-8 h-8" />
          Cross-Device Clipboard
        </h1>
        <p className="text-muted-foreground">
          Paste text here → share the short ID → retrieve on another device
        </p>
      </div>

      {/* Create Section */}
      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Clipboard className="w-5 h-5" />
          Create New Entry
        </h2>
        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Paste or type text to share..."
          className="min-h-[120px] font-mono text-sm"
          rows={6}
        />
        <div className="flex gap-3">
          <Button
            onClick={createClipboard}
            disabled={loading || !content.trim()}
            className="flex-1"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              "Generate Share ID"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => copyToClipboard(shareUrl)}
            title="Copy base URL"
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={cn(
            "fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in",
            message.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          )}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Retrieve Section */}
      <div className="border rounded-lg p-6 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Clipboard className="w-5 h-5" />
          Retrieve by ID
        </h2>
        <div className="flex gap-2">
          <Input
            placeholder="Enter 8-char ID (e.g. a1b2c3d4)"
            maxLength={8}
            onKeyDown={e => e.key === "Enter" && e.currentTarget.value && fetchById(e.currentTarget.value)}
            className="flex-1 text-center text-lg font-mono tracking-wider"
          />
          <Button onClick={e => { const input = e.currentTarget.previousElementSibling as HTMLInputElement; input?.value && fetchById(input.value) }} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load & Copy"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Full URL: <code className="font-mono text-primary">{shareUrl}</code><wbr/><span className="font-mono">ID</span>
        </p>
      </div>

      {/* Recent Items */}
      {items.length > 0 && (
        <div className="border rounded-lg p-6 space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="w-5 h-5" />
            Recent Entries
          </h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {items.map(item => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 p-3 bg-muted/50 rounded-lg",
                  copiedId === item.id && "ring-2 ring-green-500"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-lg font-semibold">{item.id}</code>
                    <Badge variant="secondary" className="text-xs">
                      {formatTime(item.expires_at)} left
                    </Badge>
                    {copiedId === item.id && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate font-mono">
                    {item.content.slice(0, 100)}{item.content.length > 100 ? "..." : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(item.content, item.id)} title="Copy content">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteItem(item.id)} title="Delete">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="border-dashed border rounded-lg p-6">
        <h3 className="font-semibold mb-3">How it works</h3>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><span className="font-mono bg-muted px-1.5 py-0.5 rounded">1</span> Paste text and click "Generate Share ID"</li>
          <li className="flex items-start gap-2"><span className="font-mono bg-muted px-1.5 py-0.5 rounded">2</span> Share the 8-character ID (or full URL) with another device</li>
          <li className="flex items-start gap-2"><span className="font-mono bg-muted px-1.5 py-0.5 rounded">3</span> On the other device, enter the ID and click "Load & Copy"</li>
          <li className="flex items-start gap-2"><span className="font-mono bg-muted px-1.5 py-0.5 rounded">4</span> Text is automatically copied to clipboard</li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Entries expire in 1 hour. Stored in memory on the server — not persistent across restarts.
        </p>
      </div>
    </div>
  )
}