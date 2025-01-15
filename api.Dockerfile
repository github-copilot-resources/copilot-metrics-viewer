# Stage 1: Build the Vue.js application
# mode can be 'prod' - default or 'playwright'
# for 'playwright' mode, the final image will be base-playwright
# for 'prod' mode, the final image will be base-prod
# build with 'docker build -f api.Dockerfile -t api --build-arg mode=playwright .'
# build with 'docker build -f api.Dockerfile -t api .' for production
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

WORKDIR /api

# Copy package.json and other necessary files for the API
COPY --chown=1000:1000 api/package*.json ./
RUN npm ci && \
    chown -R 1000:1000 /api && \
    apk update && \
    apk add --no-cache gettext && \
    rm -rf /var/cache/apk/*

# Copy the rest of your API source code
COPY --chown=1000:1000 api/ .

# Copy the built Vue.js app from the previous stage
COPY --chown=1000:1000 --from=build-stage /app/dist /api/public
COPY --chown=1000:1000 --from=build-stage /app/dist/assets/app-config.js /api/app-config.template.js
COPY --chown=1000:1000 --from=build-stage /app/mock-data /mock-data

# Expose the port your API will run on
EXPOSE 3000

# Command to run your API (and serve your Vue.js app)
RUN chmod +x /api/docker-entrypoint.api/entrypoint.sh

USER node
ENTRYPOINT ["/api/docker-entrypoint.api/entrypoint.sh"]

#-----------------------------------
FROM mcr.microsoft.com/playwright:v1.49.1 AS base-playwright

WORKDIR /pw

RUN apt-get update && \
    apt-get install -y --no-install-recommends gettext-base && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY --chown=1000:1000 --from=base-prod /api /api
COPY --chown=1000:1000 --from=base-prod /mock-data /mock-data
COPY --chown=1000:1000 tests ./tests
COPY --chown=1000:1000 playwright.config.ts .
COPY --chown=1000:1000 playwright.docker.config.ts .


RUN npm install @playwright/test@1.49.1 
# RUN npx playwright install --with-deps

ENTRYPOINT [ "npx", "playwright", "test", "-c", "playwright.docker.config.ts", "--output", "/test-results", "--grep"]

#-----------------------------------
FROM base-${mode} AS final
