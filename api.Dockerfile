# Stage 1: Build the Vue.js application
FROM node:14 as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# this will tokenize the app
RUN npm run build

# Stage 2: Prepare the Node.js API
FROM node:14 as api-stage
WORKDIR /api
# Copy package.json and other necessary files for the API
COPY api/package*.json ./
RUN npm install
# Copy the rest of your API source code
COPY api/ .

# Copy the built Vue.js app from the previous stage
COPY --from=build-stage /app/dist /api/public
COPY --from=build-stage /app/dist/assets/app-config.js /api/app-config.template.js

# install gettext-base for envsubst
RUN apt-get update && apt-get install -y gettext-base

# Expose the port your API will run on
EXPOSE 3000

# Command to run your API (and serve your Vue.js app)
RUN chmod +x /api/docker-entrypoint.api/entrypoint.sh
ENTRYPOINT ["/api/docker-entrypoint.api/entrypoint.sh"]