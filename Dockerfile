# Stage 1: Build the Vue.js application
# mode can be 'prod' - default or 'playwright'
# for 'playwright' mode, the final image will be base-playwright
# for 'prod' mode, the final image will be base-prod
# build with 'docker build -t copilot-metrics-pw --build-arg mode=playwright .'
# build with 'docker build -t copilot-metrics .' for production
ARG mode=prod

FROM node:24-alpine AS build-stage

# Add build dependencies and security updates
RUN apk update && \
    apk upgrade && \
    apk add --no-cache dumb-init

# Use non-root user for security
USER node
WORKDIR /app

# Copy package files first for better layer caching
COPY --chown=1000:1000 package*.json ./

# Install dependencies with npm ci for reproducible builds
# Use --no-audit to speed up the build
RUN npm ci --no-audit --no-fund && \
    npm cache clean --force

# Copy source code
COPY --chown=1000:1000 . .

# Build the application
RUN npm run build

# Stage 2: Prepare the Node.js API
FROM node:24-alpine AS base-prod

# Add security updates and dumb-init for proper process handling
RUN apk update && \
    apk upgrade && \
    apk add --no-cache dumb-init curl && \
    # Add a non-privileged user for running the application
    addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Set working directory and copy built application
WORKDIR /app
COPY --chown=1001:1001 --from=build-stage /app/.output /app

# Create a health check script
RUN echo '#!/bin/sh' > /healthcheck.sh && \
    echo 'curl -f http://localhost:${NITRO_PORT:-80}/api/health || exit 1' >> /healthcheck.sh && \
    chmod +x /healthcheck.sh

# Expose the port your API will run on
EXPOSE 80

# Set port to 80 for backwards compatibility
ENV NITRO_PORT=80 \
    NODE_ENV=production

# Re-map the environment variables for the Vue.js app for backwards compatibility
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'export NUXT_PUBLIC_IS_DATA_MOCKED=${NUXT_PUBLIC_IS_DATA_MOCKED:-$VUE_APP_MOCKED_DATA}' >> /entrypoint.sh && \
    echo 'export NUXT_PUBLIC_SCOPE=${NUXT_PUBLIC_SCOPE:-$VUE_APP_SCOPE}' >> /entrypoint.sh && \
    echo 'export NUXT_PUBLIC_GITHUB_ORG=${NUXT_PUBLIC_GITHUB_ORG:-$VUE_APP_GITHUB_ORG}' >> /entrypoint.sh && \
    echo 'export NUXT_PUBLIC_GITHUB_ENT=${NUXT_PUBLIC_GITHUB_ENT:-$VUE_APP_GITHUB_ENT}' >> /entrypoint.sh && \
    echo 'export NUXT_PUBLIC_GITHUB_TEAM=${NUXT_PUBLIC_GITHUB_TEAM:-$VUE_APP_GITHUB_TEAM}' >> /entrypoint.sh && \
    echo 'export NUXT_GITHUB_TOKEN=${NUXT_GITHUB_TOKEN:-$VUE_APP_GITHUB_TOKEN}' >> /entrypoint.sh && \
    echo 'export NUXT_SESSION_PASSWORD=${NUXT_SESSION_PASSWORD:-$SESSION_SECRET$SESSION_SECRET$SESSION_SECRET$SESSION_SECRET}' >> /entrypoint.sh && \
    # in case SESSION_SECRET is not set, use NUXT_GITHUB_TOKEN as a fallback
    echo 'export NUXT_SESSION_PASSWORD=${NUXT_SESSION_PASSWORD:-$NUXT_GITHUB_TOKEN$NUXT_GITHUB_TOKEN}' >> /entrypoint.sh && \
    echo 'export NUXT_OAUTH_GITHUB_CLIENT_ID=${NUXT_OAUTH_GITHUB_CLIENT_ID:-$GITHUB_CLIENT_ID}' >> /entrypoint.sh && \
    echo 'export NUXT_OAUTH_GITHUB_CLIENT_SECRET=${NUXT_OAUTH_GITHUB_CLIENT_SECRET:-$GITHUB_CLIENT_SECRET}' >> /entrypoint.sh && \
    # Set default theme to ensure consistent appearance
    echo 'export NUXT_PUBLIC_DEFAULT_THEME=${NUXT_PUBLIC_DEFAULT_THEME:-dark}' >> /entrypoint.sh && \
    # Conditionally set NUXT_PUBLIC_USING_GITHUB_AUTH if GITHUB_CLIENT_ID is provided
    echo 'if [ -n "$GITHUB_CLIENT_ID" ]; then' >> /entrypoint.sh && \
    echo 'export NUXT_PUBLIC_USING_GITHUB_AUTH=true' >> /entrypoint.sh && \
    echo 'fi' >> /entrypoint.sh && \
    echo 'exec dumb-init -- node /app/server/index.mjs' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Configure Docker health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["/healthcheck.sh"]

# Set proper permissions and switch to non-root user
RUN chown -R 1001:1001 /app
USER appuser
ENTRYPOINT ["/entrypoint.sh"]

#----------------------------------- PW layer - not used in production
FROM mcr.microsoft.com/playwright:v1.49.1 AS base-playwright

WORKDIR /pw

# Install only necessary packages and clean up to reduce image size
RUN apt-get update && \
    apt-get install -y --no-install-recommends gettext-base curl dumb-init && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    # Create a non-root user for running tests
    groupadd -g 1001 pwuser && \
    useradd -u 1001 -g pwuser -m pwuser

# Copy application and test files
COPY --chown=1001:1001 --from=base-prod /app /app
COPY --chown=1001:1001 e2e-tests ./e2e-tests
COPY --chown=1001:1001 playwright.config.ts playwright.docker.config.ts tsconfig.json package*.json ./

# Install only dev dependencies and clean cache
RUN npm install --only=dev && \
    npm cache clean --force

# Create a wrapper script for better process handling
RUN echo '#!/bin/sh' > /entrypoint-pw.sh && \
    echo 'exec dumb-init -- npx playwright test -c playwright.docker.config.ts "$@"' >> /entrypoint-pw.sh && \
    chmod +x /entrypoint-pw.sh

# Switch to non-root user for security
USER pwuser
ENTRYPOINT ["/entrypoint-pw.sh"]

#-----------------------------------
FROM base-${mode} AS final
