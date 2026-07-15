# Build stage - download fixed d2 version
FROM alpine:3.20 AS d2-downloader

RUN apk add --no-cache curl

# Download specific d2 version (more reliable than latest API)
ARG D2_VERSION=v0.1.33
RUN curl -L -o /usr/local/bin/d2 "https://github.com/terrastruct/d2/releases/download/${D2_VERSION}/d2_${D2_VERSION}_linux_amd64" \
    && chmod +x /usr/local/bin/d2 \
    && d2 --version

# Final stage
FROM python:3.12-slim

# Copy d2 binary
COPY --from=d2-downloader /usr/local/bin/d2 /usr/local/bin/d2

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Allow access to host's ollama (host.docker.internal works on Docker Desktop)
# For Linux, use --add-host=host.docker.internal:host-gateway
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]