#!/bin/sh

configTemplateFile=/usr/share/nginx/html-template/app-config.template.js
configTargetFile=/usr/share/nginx/html/assets/app-config.js

envsubst <"$configTemplateFile" >"$configTargetFile"
