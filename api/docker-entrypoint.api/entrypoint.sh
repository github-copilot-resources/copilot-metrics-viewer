#!/bin/bash

configTemplateFile=/api/app-config.template.js
configTargetFile=/api/public/assets/app-config.js

# Temporarily unset VUE_APP_GITHUB_TOKEN
# this is requiered until vue app is updated to remove tokens from it
tempToken=$VUE_APP_GITHUB_TOKEN
unset VUE_APP_GITHUB_TOKEN

envsubst <"$configTemplateFile" >"$configTargetFile"

# Restore VUE_APP_GITHUB_TOKEN
export VUE_APP_GITHUB_TOKEN=$tempToken

node server.mjs