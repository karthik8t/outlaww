# Build stage - download d2 binary from GitHub releases
FROM alpine:3.20 AS d2-downloader

# Install curl
RUN apk add --no-cache curl

# Download latest d2 Linux AMD64 binary from GitHub releases
RUN curl -sL https://api.github.com/repos/terrastruct/d2/releases/latest \
    | grep "browser_download_url.*linux_amd64" \
    | cut -d '"' -f 4 \
    | xargs curl -L -o /usr/local/bin/d2 \
    && chmod +x /usr/local/bin/d2

# Verify it works
RUN d2 --version

# Final stage
FROM python:3.12-slim

# Copy d2 binary from downloader
COPY --from=d2-downloader /usr/local/bin/d2 /usr/local/bin/d2

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]