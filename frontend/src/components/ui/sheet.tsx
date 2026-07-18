import { forwardRef, useEffect, useCallback } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function Portal({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function Sheet({ open, onOpenChange, children }: SheetProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onOpenChange(false)
  }, [onOpenChange])

  useEffect(() => {
    if (!open) return
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, handleKeyDown])

  if (!open) return null

  return <Portal>{children}</Portal>
}

const SheetOverlay = forwardRef<HTMLDivElement, { className?: string }>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/20 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
)
SheetOverlay.displayName = "SheetOverlay"

const SheetContent = forwardRef<HTMLDivElement, { className?: string; children: React.ReactNode; onClose?: () => void }>(
  ({ className, children, onClose, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="sheet-content"
      className={cn(
        "fixed right-0 top-0 bottom-0 z-50 w-80 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-lg flex flex-col",
        "data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
        "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
        className
      )}
      {...props}
    >
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 h-6 w-6 z-10"
          onClick={onClose}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
      {children}
    </div>
  )
)
SheetContent.displayName = "SheetContent"

const SheetHeader = forwardRef<HTMLDivElement, { className?: string; children: React.ReactNode }>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="sheet-header"
      className={cn("shrink-0", className)}
      {...props}
    >
      {children}
    </div>
  )
)
SheetHeader.displayName = "SheetHeader"

const SheetBody = forwardRef<HTMLDivElement, { className?: string; children: React.ReactNode }>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="sheet-body"
      className={cn("flex-1 overflow-y-auto", className)}
      {...props}
    >
      {children}
    </div>
  )
)
SheetBody.displayName = "SheetBody"

export { Sheet, SheetOverlay, SheetContent, SheetHeader, SheetBody }
