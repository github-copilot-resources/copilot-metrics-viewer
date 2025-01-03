# Stage 1: Build the Vue.js application
FROM node:23-alpine AS build-stage

USER node
WORKDIR /app

COPY --chown=1000:1000 package*.json ./
RUN npm install
COPY --chown=1000:1000 . .
RUN npm run build

# Stage 2: Prepare the Node.js API
FROM node:23-alpine AS api-stage

WORKDIR /api

# Copy package.json and other necessary files for the API
COPY --chown=1000:1000 api/package*.json ./
RUN npm install && \
    chown -R 1000:1000 /api && \
    apk update && \
    apk add --no-cache gettext && \
    rm -rf /var/cache/apk/*

# Copy the rest of your API source code
COPY --chown=1000:1000 api/ .

# Copy the built Vue.js app from the previous stage
COPY --chown=1000:1000 --from=build-stage /app/dist /api/public
COPY --chown=1000:1000 --from=build-stage /app/dist/assets/app-config.js /api/app-config.template.js

# Expose the port your API will run on
EXPOSE 3000

# Command to run your API (and serve your Vue.js app)
RUN chmod +x /api/docker-entrypoint.api/entrypoint.sh

USER node
ENTRYPOINT ["/api/docker-entrypoint.api/entrypoint.sh"]