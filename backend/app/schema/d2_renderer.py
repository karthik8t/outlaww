"""D2 Renderer: Three rendering mechanisms for D2 diagrams.

1. CLI (Server-side): subprocess call to `d2` binary - full fidelity
2. WASM (Browser): @d2lang/d2 npm package - interactive, offline
3. SSE (Streaming): FastAPI StreamingResponse - progressive, collaborative
"""
from __future__ import annotations

import asyncio
import subprocess
from pathlib import Path
from typing import AsyncGenerator, Literal, Optional

from fastapi.responses import StreamingResponse

from app.schema.d2_models import D2Diagram, RenderOptions
from app.schema.d2_serializer import serialize_d2


# ============================================================================
# Render Options
# ============================================================================

RenderFormat = Literal["svg", "png", "pdf", "gif", "pptx"]


class D2RenderError(Exception):
    """Raised when D2 rendering fails."""
    def __init__(self, message: str, stderr: str = "", exit_code: int = -1):
        super().__init__(message)
        self.stderr = stderr
        self.exit_code = exit_code


# ============================================================================
# D2 Binary Path
# ============================================================================

D2_BINARY = "d2"  # Assumes `d2` is in PATH


def get_d2_binary() -> str:
    """Get path to d2 binary. Can be overridden via env var."""
    import os
    return os.environ.get("D2_BINARY", D2_BINARY)


# ============================================================================
# 1. Server-side CLI Rendering (Primary Production Path)
# ============================================================================

async def render_cli(
    diagram: D2Diagram,
    options: Optional[RenderOptions] = None,
) -> bytes:
    """
    Render D2 diagram using the CLI binary asynchronously.
    
    Returns raw bytes (SVG/PNG/PDF/GIF/PPTX).
    """
    opts = options or RenderOptions()
    d2_source = serialize_d2(diagram)

    # Build CLI args
    args = [get_d2_binary()]

    # Theme
    if opts.theme_id is not None:
        args.extend(["-t", str(opts.theme_id)])
    if opts.dark_theme_id is not None:
        args.extend(["--dark-theme", str(opts.dark_theme_id)])

    # Layout engine
    if opts.layout_engine:
        args.extend(["--layout", opts.layout_engine])

    # Direction
    if opts.direction:
        args.extend(["-d", opts.direction])

    # Padding
    if opts.pad != 100:
        args.extend(["-p", str(opts.pad)])

    # Sketch mode
    if opts.sketch:
        args.append("--sketch")

    # Animation interval
    if opts.animate_interval is not None:
        args.extend(["--animate-interval", str(opts.animate_interval)])

    # Output format
    fmt = opts.format or "svg"
    args.extend(["-f", fmt])

    # Scale (for raster formats)
    if opts.scale and fmt in ("png", "jpg", "jpeg"):
        args.extend(["-s", str(opts.scale)])

    # Input from stdin, output to stdout
    args.extend(["-", "-"])

    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate(input=d2_source.encode("utf-8"))

        if proc.returncode != 0:
            raise D2RenderError(
                f"d2 CLI failed with exit code {proc.returncode}",
                stderr=stderr.decode("utf-8", errors="replace"),
                exit_code=proc.returncode,
            )

        return stdout

    except FileNotFoundError:
        raise D2RenderError(
            "d2 binary not found. Install with: go install github.com/terrastruct/d2@latest",
            stderr="",
            exit_code=-1,
        )
    except Exception as e:
        raise D2RenderError(f"CLI render failed: {e}", stderr=str(e), exit_code=-1)


def render_cli_sync(
    diagram: D2Diagram,
    options: Optional[RenderOptions] = None,
) -> bytes:
    """Synchronous version for non-async contexts."""
    opts = options or RenderOptions()
    d2_source = serialize_d2(diagram)

    args = [get_d2_binary()]

    if opts.theme_id is not None:
        args.extend(["-t", str(opts.theme_id)])
    if opts.dark_theme_id is not None:
        args.extend(["--dark-theme", str(opts.dark_theme_id)])
    if opts.layout_engine:
        args.extend(["--layout", opts.layout_engine])
    if opts.direction:
        args.extend(["-d", opts.direction])
    if opts.pad != 100:
        args.extend(["-p", str(opts.pad)])
    if opts.sketch:
        args.append("--sketch")
    if opts.animate_interval is not None:
        args.extend(["--animate-interval", str(opts.animate_interval)])

    fmt = opts.format or "svg"
    args.extend(["-f", fmt])

    if opts.scale and fmt in ("png", "jpg", "jpeg"):
        args.extend(["-s", str(opts.scale)])

    args.extend(["-", "-"])

    try:
        result = subprocess.run(
            args,
            input=d2_source.encode("utf-8"),
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0:
            raise D2RenderError(
                f"d2 CLI failed with exit code {result.returncode}",
                stderr=result.stderr.decode("utf-8", errors="replace"),
                exit_code=result.returncode,
            )
        return result.stdout
    except FileNotFoundError:
        raise D2RenderError(
            "d2 binary not found. Install with: go install github.com/terrastruct/d2@latest",
            stderr="",
            exit_code=-1,
        )
    except subprocess.TimeoutExpired:
        raise D2RenderError("d2 CLI timed out after 30 seconds", stderr="timeout", exit_code=-1)


# ============================================================================
# 2. WASM Browser Rendering (Frontend)
// This is a placeholder - actual rendering happens in browser via @d2lang/d2
// The frontend imports: import { render } from '@d2lang/d2'
// Usage: const svg = await render(d2Source, { layout: 'elk', theme: 100 })
# ============================================================================

def get_wasm_render_info() -> dict:
    """
    Returns info needed for frontend WASM rendering.
    Frontend should use @d2lang/d2 npm package directly.
    """
    return {
        "package": "@d2lang/d2",
        "import": "import { render } from '@d2lang/d2'",
        "usage": "const svg = await render(d2Source, { layout: 'elk', theme: 100 })",
        "wasm_url": "/wasm/d2.wasm",  # If self-hosted
        "js_url": "/wasm/d2.js",
    }


# ============================================================================
# 3. SSE Streaming (Progressive / Collaborative)
# ============================================================================

async def stream_svg_chunks(
    diagram: D2Diagram,
    options: Optional[RenderOptions] = None,
    chunk_size: int = 8192,
) -> AsyncGenerator[str, None]:
    """
    Stream SVG output as Server-Sent Events.
    
    Yields SSE-formatted chunks:
    - event: start / data: {"format": "svg"}
    - event: chunk / data: <svg_fragment>
    - event: end / data: {"bytes": N}
    - event: error / data: <error_message> (on failure)
    """
    opts = options or RenderOptions()
    d2_source = serialize_d2(diagram)

    # Build CLI args for SVG output
    args = [get_d2_binary()]
    if opts.theme_id is not None:
        args.extend(["-t", str(opts.theme_id)])
    if opts.layout_engine:
        args.extend(["--layout", opts.layout_engine])
    if opts.direction:
        args.extend(["-d", opts.direction])
    if opts.pad != 100:
        args.extend(["-p", str(opts.pad)])
    if opts.sketch:
        args.append("--sketch")
    args.extend(["-f", "svg", "-", "-"])

    proc = await asyncio.create_subprocess_exec(
        *args,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    # Send start event
    yield f"event: start\ndata: {{\"format\": \"svg\"}}\n\n"

    try:
        # Write input
        proc.stdin.write(d2_source.encode("utf-8"))
        await proc.stdin.drain()
        proc.stdin.close()

        # Stream stdout in chunks
        total_bytes = 0
        while True:
            chunk = await proc.stdout.read(chunk_size)
            if not chunk:
                break
            total_bytes += len(chunk)
            # Escape for SSE (newlines -> \n)
            chunk_text = chunk.decode("utf-8", errors="replace")
            chunk_text = chunk_text.replace("\n", "\\n").replace("\r", "\\r")
            yield f"event: chunk\ndata: {chunk_text}\n\n"

        await proc.wait()

        if proc.returncode != 0:
            stderr = (await proc.stderr.read()).decode("utf-8", errors="replace")
            yield f"event: error\ndata: {stderr}\n\n"
            return

        # End event
        yield f"event: end\ndata: {{\"bytes\": {total_bytes}}}\n\n"

    except Exception as e:
        yield f"event: error\ndata: {str(e)}\n\n"


async def render_sse_response(
    diagram: D2Diagram,
    options: Optional[RenderOptions] = None,
) -> StreamingResponse:
    """
    Create a FastAPI StreamingResponse for SSE rendering.
    
    Usage:
        @app.get("/api/diagrams/{id}/stream")
        async def stream_diagram(id: str):
            diagram = get_diagram(id)
            return await render_sse_response(diagram)
    """
    return StreamingResponse(
        stream_svg_chunks(diagram, options),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


# ============================================================================
# Convenience: Render to File
# ============================================================================

async def render_to_file(
    diagram: D2Diagram,
    output_path: Path,
    options: Optional[RenderOptions] = None,
) -> Path:
    """Render diagram directly to a file."""
    data = await render_cli(diagram, options)
    output_path.write_bytes(data)
    return output_path


def render_to_file_sync(
    diagram: D2Diagram,
    output_path: Path,
    options: Optional[RenderOptions] = None,
) -> Path:
    """Synchronous version."""
    data = render_cli_sync(diagram, options)
    output_path.write_bytes(data)
    return output_path


# ============================================================================
# Health Check
# ============================================================================

async def check_d2_available() -> tuple[bool, str]:
    """Check if d2 binary is available and get version."""
    try:
        proc = await asyncio.create_subprocess_exec(
            get_d2_binary(), "--version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode == 0:
            version = stdout.decode("utf-8").strip()
            return True, version
        return False, stderr.decode("utf-8", errors="replace")
    except FileNotFoundError:
        return False, "d2 binary not found in PATH"
    except Exception as e:
        return False, str(e)


def check_d2_available_sync() -> tuple[bool, str]:
    """Synchronous version."""
    try:
        result = subprocess.run(
            [get_d2_binary(), "--version"],
            capture_output=True,
            timeout=5,
        )
        if result.returncode == 0:
            return True, result.stdout.decode("utf-8").strip()
        return False, result.stderr.decode("utf-8", errors="replace")
    except FileNotFoundError:
        return False, "d2 binary not found in PATH"
    except Exception as e:
        return False, str(e)