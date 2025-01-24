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
EXPOSE 3000

USER node
CMD ["node", "/app/server/index.mjs"]

#-----------------------------------
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

# RUN npx playwright install --with-deps
# this isn't a secret - it's only used in Playwright tests
ENV NUXT_SESSION_PASSWORD=foo-foo-foo-foo-foo-foo-foo-foo-foo-foo-foo-foo
# ENV CI=true

ENTRYPOINT [ "npx", "playwright", "test", "-c", "playwright.docker.config.ts" ]

#-----------------------------------
FROM base-${mode} AS final
