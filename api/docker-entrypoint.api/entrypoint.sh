#!/bin/bash

configTemplateFile=/api/app-config.template.js
configTargetFile=/api/public/assets/app-config.js

envsubst <"$configTemplateFile" >"$configTargetFile"

node server.mjs