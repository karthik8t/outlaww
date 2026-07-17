/**
 * Peer-to-Peer Clipboard - No backend required.
 * Uses WebRTC Data Channels with manual signaling (copy SDP between devices).
 * Works across devices on same network or internet via STUN.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Clipboard, Wifi, WifiOff, Loader2, CheckCircle, AlertCircle, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STUN_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
}

const CHANNEL_NAME = "clipboard-sync"

export function P2PClipboard() {
  const [text, setText] = useState("")
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "disconnected">("idle")
  const [localSDP, setLocalSDP] = useState("")
  const [remoteSDP, setRemoteSDP] = useState("")
  const [connectedPeers, setConnectedPeers] = useState<number>(0)
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<RTCDataChannel | null>(null)
  const isInitiatorRef = useRef(false)

  // Cleanup message
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000)
      return () => clearTimeout(t)
    }
  }, [message])

  const showMsg = useCallback((type: "success" | "error" | "info", text: string) => {
    setMessage({ type, text })
  }, [])

  const copyToClipboard = useCallback(async (content: string, label = "Copied!") => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      showMsg("success", label)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showMsg("error", "Failed to copy")
    }
  }, [showMsg])

  const createPeerConnection = useCallback((isInitiator: boolean) => {
    const pc = new RTCPeerConnection(STUN_SERVERS)
    pcRef.current = pc
    isInitiatorRef.current = isInitiator

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      if (state === "connected" || state === "completed") {
        setStatus("connected")
        showMsg("success", "Connected! Text will sync automatically.")
      } else if (state === "disconnected" || state === "failed" || state === "closed") {
        setStatus("disconnected")
        showMsg("info", "Disconnected")
      } else if (state === "checking") {
        setStatus("connecting")
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate === null && pc.localDescription) {
        // ICE gathering complete, SDP is ready
        const sdp = JSON.stringify(pc.localDescription)
        setLocalSDP(sdp)
        copyToClipboard(sdp, "Local SDP copied! Paste on other device.")
        showMsg("info", "SDP ready — copy and send to other device")
      }
    }

    if (isInitiator) {
      // Create data channel
      const channel = pc.createDataChannel(CHANNEL_NAME)
      setupChannel(channel)
    } else {
      pc.ondatachannel = (e) => {
        setupChannel(e.channel)
      }
    }

    return pc
  }, [copyToClipboard, showMsg])

  const setupChannel = useCallback((channel: RTCDataChannel) => {
    channelRef.current = channel

    channel.onopen = () => {
      setConnectedPeers(prev => prev + 1)
      // Send current text on connect
      if (text) channel.send(text)
    }

    channel.onclose = () => {
      setConnectedPeers(prev => Math.max(0, prev - 1))
      if (connectedPeers <= 1) setStatus("disconnected")
    }

    channel.onmessage = (e) => {
      const newText = e.data
      if (newText !== text) {
        setText(newText)
        showMsg("info", "Synced from peer")
      }
    }

    channel.onerror = (err) => {
      console.error("Data channel error:", err)
      showMsg("error", "Channel error")
    }
  }, [text, connectedPeers, showMsg])

  const sendText = useCallback((newText: string) => {
    setText(newText)
    if (channelRef.current?.readyState === "open") {
      channelRef.current.send(newText)
    }
  }, [])

  const startAsHost = useCallback(async () => {
    if (pcRef.current) {
      pcRef.current.close()
    }
    setStatus("connecting")
    setLocalSDP("")
    setRemoteSDP("")
    const pc = createPeerConnection(true)
    
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      // onicecandidate will fire when gathering complete
    } catch (err) {
      console.error(err)
      showMsg("error", "Failed to create offer")
      setStatus("idle")
    }
  }, [createPeerConnection, showMsg])

  const joinAsGuest = useCallback(async () => {
    if (!remoteSDP.trim()) {
      showMsg("error", "Paste the host's SDP first")
      return
    }
    if (pcRef.current) {
      pcRef.current.close()
    }
    setStatus("connecting")
    const pc = createPeerConnection(false)
    
    try {
      const offer = JSON.parse(remoteSDP)
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      // onicecandidate will fire when gathering complete
    } catch (err) {
      console.error(err)
      showMsg("error", "Invalid SDP or connection failed")
      setStatus("idle")
    }
  }, [remoteSDP, createPeerConnection, showMsg])

  const disconnect = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    channelRef.current = null
    setStatus("idle")
    setLocalSDP("")
    setRemoteSDP("")
    setConnectedPeers(0)
    showMsg("info", "Disconnected")
  }, [showMsg])

  const clearText = useCallback(() => {
    setText("")
    if (channelRef.current?.readyState === "open") {
      channelRef.current.send("")
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pcRef.current) {
        pcRef.current.close()
      }
    }
  }, [])

  const statusConfig = {
    idle: { icon: WifiOff, label: "Not connected", color: "text-muted-foreground" },
    connecting: { icon: Loader2, label: "Connecting...", color: "text-amber-500" },
    connected: { icon: Wifi, label: `Connected (${connectedPeers} peer${connectedPeers !== 1 ? "s" : ""})`, color: "text-green-500" },
    disconnected: { icon: WifiOff, label: "Disconnected", color: "text-red-500" },
  }

  const { icon: StatusIcon, label: statusLabel, color: statusColor } = statusConfig[status]

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Clipboard className="w-8 h-8" />
          P2P Clipboard
        </h1>
        <p className="text-muted-foreground text-sm">
          No server — direct peer-to-peer via WebRTC. Works across devices on any network.
        </p>
      </div>

      {/* Status Bar */}
      <div className={cn("flex items-center justify-center gap-3 px-4 py-3 rounded-lg border", `bg-${statusColor.replace("text-", "bg-")}/10 border-${statusColor.replace("text-", "")}/30`)}>
        <StatusIcon className={cn("w-5 h-5 animate-spin", statusColor)} />
        <span className={cn("font-medium", statusColor)}>{statusLabel}</span>
        {status === "connected" && (
          <Badge variant="outline" className="text-xs">{connectedPeers} peer{connectedPeers !== 1 ? "s" : ""}</Badge>
        )}
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
          {message.type === "error" && <AlertCircle className="w-5 h-5" />}
          {message.type === "info" && <Loader2 className="w-5 h-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Text Area */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Clipboard className="w-5 h-5" />
            Shared Clipboard
          </h2>
          {text && (
            <Button variant="ghost" size="icon" onClick={clearText} title="Clear">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          )}
        </div>
        <Textarea
          value={text}
          onChange={e => sendText(e.target.value)}
          placeholder={status === "connected" 
            ? "Type here — syncs instantly to connected peers" 
            : "Connect first, then text will sync across devices"}
          className="min-h-[200px] font-mono text-sm"
          rows={10}
          disabled={status !== "connected"}
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{text.length} characters</span>
          {status === "connected" && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span>Live sync active</span>
            </>
          )}
        </div>
      </div>

      {/* Connection Controls */}
      <div className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Wifi className="w-5 h-5" />
          Connection
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Host */}
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <h3 className="font-medium text-sm">🖥️ Host (Create Session)</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Click to create offer, then share the SDP with other devices
            </p>
            <Button 
              onClick={startAsHost} 
              disabled={status === "connecting"}
              className="w-full"
              size="lg"
            >
              {status === "connecting" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : status === "connected" ? (
                "New Session (Disconnects Current)"
              ) : (
                "Start Hosting"
              )}
            </Button>
          </div>

          {/* Guest */}
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <h3 className="font-medium text-sm">📱 Join (Enter Host SDP)</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Paste the host's SDP JSON here, then click Join
            </p>
            <Input
              value={remoteSDP}
              onChange={e => setRemoteSDP(e.target.value)}
              placeholder="Paste host SDP JSON here..."
              className="font-mono text-xs"
            />
            <Button 
              onClick={joinAsGuest} 
              disabled={status === "connecting" || !remoteSDP.trim()}
              className="w-full"
              size="lg"
            >
              {status === "connecting" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                "Join Session"
              )}
            </Button>
          </div>
        </div>

        {/* Disconnect */}
        {status !== "idle" && (
          <Button variant="outline" onClick={disconnect} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Disconnect
          </Button>
        )}

        {/* Your SDP (when hosting) */}
        {localSDP && (
          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Your SDP (Copy & Share)</h3>
              <Badge variant="secondary" className="text-xs">
                {copied ? "Copied!" : "Click to copy"}
              </Badge>
            </div>
            <Textarea
              value={localSDP}
              onClick={() => copyToClipboard(localSDP, "SDP copied! Send to other device.")}
              readOnly
              className="min-h-[80px] font-mono text-[10px] cursor-pointer"
              rows={4}
              title="Click to copy SDP"
            />
            <p className="text-xs text-muted-foreground">
              Send this JSON to the other device (via chat, email, QR code, etc.)
            </p>
          </div>
        )}

        {/* Remote SDP Input (when joining) */}
        {!localSDP && remoteSDP && (
          <div className="space-y-2 pt-4 border-t">
            <h3 className="font-medium text-sm">Remote SDP (Ready to Join)</h3>
            <Textarea
              value={remoteSDP}
              readOnly
              className="min-h-[80px] font-mono text-[10px]"
              rows={4}
            />
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="border-dashed border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">How it works</h3>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><span className="font-mono bg-muted px-1.5 py-0.5 rounded">1</span> One device clicks <strong>"Start Hosting"</strong> — generates an SDP offer</li>
          <li className="flex items-start gap-2"><span className="font-mono bg-muted px-1.5 py-0.5 rounded">2</span> Copy the <strong>SDP JSON</strong> and send it to other device(s) (any chat, email, QR)</li>
          <li className="flex items-start gap-2"><span className="font-mono bg-muted px-1.5 py-0.5 rounded">3</span> Other device(s) paste the SDP and click <strong>"Join Session"</strong></li>
          <li className="flex items-start gap-2"><span className="font-mono bg-muted px-1.5 py-0.5 rounded">4</span> WebRTC connects directly (P2P via STUN) — text syncs instantly</li>
        </ol>
        <div className="mt-3 p-3 bg-muted/50 rounded text-xs text-muted-foreground space-y-1">
          <p><strong>No server needed</strong> — Uses Google's public STUN servers for NAT traversal</p>
          <p>Works across <strong>any network</strong> (same WiFi, different WiFi, mobile data, etc.)</p>
          <p>Multiple devices can join the same host</p>
          <p>Connection persists until you click <strong>Disconnect</strong> or close the tab</p>
        </div>
      </div>
    </div>
  )
}