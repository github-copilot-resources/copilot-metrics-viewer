# Stage 1: Build the Vue.js application
# mode can be 'prod' - default or 'playwright'
# for 'playwright' mode, the final image will be base-playwright
# for 'prod' mode, the final image will be base-prod
# build with 'docker build -t copilot-metrics-pw --build-arg mode=playwright .'
# build with 'docker build -t copilot-metrics .' for production
ARG mode=prod

FROM node:23-alpine AS build-stage

USER node
WORKDIR /app

COPY --chown=1000:1000 package*.json ./
RUN npm ci
COPY --chown=1000:1000 . .
RUN npm run build

# Stage 2: Prepare the Node.js API
FROM node:23-alpine AS base-prod

WORKDIR /app
COPY --chown=1000:1000 --from=build-stage /app/.output /app

# Expose the port your API will run on
EXPOSE 80

# Set port to 80 for backwards compatibility
ENV NITRO_PORT=80

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
    # Conditionally set NUXT_PUBLIC_USING_GITHUB_AUTH if GITHUB_CLIENT_ID is provided
    echo 'if [ -n "$GITHUB_CLIENT_ID" ]; then' >> /entrypoint.sh && \
    echo 'export NUXT_PUBLIC_USING_GITHUB_AUTH=true' >> /entrypoint.sh && \
    echo 'fi' >> /entrypoint.sh && \
    echo 'node /app/server/index.mjs' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh


USER node
ENTRYPOINT [ "/entrypoint.sh" ]

#----------------------------------- PW layer - not used in production
FROM mcr.microsoft.com/playwright:v1.49.1 AS base-playwright

WORKDIR /pw

RUN apt-get update && \
    apt-get install -y --no-install-recommends gettext-base && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY --chown=1000:1000 --from=base-prod /app /app
COPY --chown=1000:1000 e2e-tests ./e2e-tests
COPY --chown=1000:1000 playwright.config.ts playwright.docker.config.ts tsconfig.json package*.json ./

RUN npm install --only=dev

ENTRYPOINT [ "npx", "playwright", "test", "-c", "playwright.docker.config.ts" ]

#-----------------------------------
FROM base-${mode} AS final
