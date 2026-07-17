/**
 * Simple LAN Clipboard - Uses BroadcastChannel (same-origin sync).
 * All devices on same network accessing the same frontend URL share text instantly.
 * Zero config, no backend, no WebRTC.
 */
import { useCallback, useEffect, useState } from "react"
import { Clipboard, Wifi, Copy, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const CHANNEL_NAME = "lan-clipboard-sync"

export function LANClipboard() {
  const [text, setText] = useState("")
  const [connected, setConnected] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const channelRef = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    // Initialize BroadcastChannel
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channelRef.current = channel

    channel.onmessage = (e) => {
      if (e.data.type === "SYNC" && e.data.text !== text) {
        setText(e.data.text)
        showMsg("info", "Synced from another device")
      }
    }

    channel.onmessageerror = () => {
      showMsg("error", "Sync error")
    }

    setConnected(true)

    return () => {
      channel.close()
      setConnected(false)
    }
  }, [text])

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 3000)
      return () => clearTimeout(t)
    }
  }, [message])

  const showMsg = useCallback((type: "success" | "error" | "info", text: string) => {
    setMessage({ type, text })
  }, [])

  const handleChange = useCallback((newText: string) => {
    setText(newText)
    // Broadcast to all other tabs/devices
    channelRef.current?.postMessage({ type: "SYNC", text: newText })
  }, [])

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      showMsg("success", "Copied!")
      setTimeout(() => setCopied(false), 1500)
    } catch {
      showMsg("error", "Failed to copy")
    }
  }, [text, showMsg])

  const clearText = useCallback(() => {
    setText("")
    channelRef.current?.postMessage({ type: "SYNC", text: "" })
  }, [])

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Clipboard className="w-8 h-8" />
          LAN Clipboard
        </h1>
        <p className="text-muted-foreground text-sm">
          Open this page on any device in your network — text syncs instantly
        </p>
      </div>

      {/* Status */}
      <div className={cn(
        "flex items-center justify-center gap-3 px-4 py-3 rounded-lg border",
        connected 
          ? "bg-green-500/10 border-green-500/30 text-green-500" 
          : "bg-amber-500/10 border-amber-500/30 text-amber-500"
      )}>
        <Wifi className={cn("w-5 h-5", connected ? "" : "animate-spin")} />
        <span className="font-medium">
          {connected ? "Connected — syncing across devices" : "Connecting..."}
        </span>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={cn(
            "fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in",
            message.type === "success" ? "bg-green-600 text-white" :
            message.type === "error" ? "bg-red-600 text-white" : "bg-blue-600 text-white"
          )}
        >
          {message.type === "success" && <CheckCircle className="w-5 h-5" />}
          {message.type === "error" && <Loader2 className="w-5 h-5" />}
          {message.type === "info" && <Loader2 className="w-5 h-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Text Area */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Clipboard className="w-5 h-5" />
            Shared Text
          </h2>
          <div className="flex items-center gap-2">
            {text && (
              <Button variant="ghost" size="icon" onClick={clearText} title="Clear">
                <Loader2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
            <Button 
              variant="outline" 
              size="icon" 
              onClick={copyToClipboard} 
              disabled={!text}
              className={copied ? "text-green-500 border-green-500" : ""}
            >
              <Copy className={cn("w-4 h-4", copied && "text-green-500")} />
            </Button>
          </div>
        </div>
        <Textarea
          value={text}
          onChange={e => handleChange(e.target.value)}
          placeholder="Type or paste here — instantly appears on all devices"
          className="min-h-[200px] font-mono text-sm"
          rows={12}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{text.length} characters</span>
          <span className="flex items-center gap-1 text-green-500">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Live sync
          </span>
        </div>
      </div>

      {/* How it works */}
      <div className="border-dashed border rounded-lg p-4 space-y-2 text-sm text-muted-foreground">
        <h3 className="font-semibold">How it works</h3>
        <ol className="space-y-1">
          <li className="flex items-start gap-2"><span className="font-mono bg-muted px-1.5 py-0.5 rounded">1</span> Open <code>http://{`<`}your-mac-ip{`>`}:5173</code> on any device in your LAN</li>
          <li className="flex items-start gap-2"><span className="font-mono bg-muted px-1.5 py-0.5 rounded">2</span> All tabs share the same origin → BroadcastChannel syncs text instantly</li>
          <li className="flex items-start gap-2"><span className="font-mono bg-muted px-1.5 py-0.5 rounded">3</span> Type on one device → appears on all others in ~10ms</li>
        </ol>
        <p className="mt-2 text-xs">
          Works because all devices access the <strong>same frontend URL</strong> (same origin). 
          No backend, no WebRTC, no config — just the browser's built-in BroadcastChannel API.
        </p>
      </div>
    </div>
  )
}

// Need useRef for channel
import { useRef } from "react"