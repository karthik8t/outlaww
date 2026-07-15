# Build stage - download d2 binary from GitHub releases
FROM alpine:3.20 AS d2-downloader

# Install curl and find the latest d2 release
RUN apk add --no-cache curl

# Download latest d2 Linux AMD64 binary
RUN curl -sL https://api.github.com/repos/terrastruct/d2/releases/latest \
    | grep "browser_download_url.*linux_amd64" \
    | cut -d '"' -f 4 \
    | xargs curl -L -o /usr/local/bin/d2 \
    && chmod +x /usr/local/bin/d2

# Verify it works
RUN d2 --version

# Final stage
FROM python:3.12-slim

# Install d2 binary from downloader
COPY --from=d2-downloader /usr/local/bin/d2 /usr/local/bin/d2

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install uv for fast Python package management
RUN pip install --no-cache-dir uv

# Copy dependency files
COPY pyproject.toml uv.lock* ./

# Install dependencies
RUN uv sync --frozen

# Copy application code
COPY app/ ./app/

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]