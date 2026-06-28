# ─── Velocity Backend — Cloud Run Dockerfile ─────────────────────────────────
# Node.js 20 LTS on slim Debian. Single-stage (no TypeScript build step needed).
# Cloud Run injects PORT at runtime — the app reads process.env.PORT.

FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy dependency manifests first (better layer caching — only re-installs when
# package.json or package-lock.json changes, not on every code change)
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Cloud Run injects PORT (usually 8080). The app falls back to 3001 locally.
# Document the expected port range — not EXPOSE 3001, because Cloud Run ignores
# EXPOSE and uses the PORT env var instead.
EXPOSE 8080

# Health check — Cloud Run startup probe hits /api/health
# Give it 30s to start (MongoDB connect can take a few seconds cold)
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Run as non-root for security
USER node

# Start the server
CMD ["node", "server.js"]
