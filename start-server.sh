#!/bin/bash

set -xeuo pipefail

# Replace the token with a new one that has the required scopes
unset GITHUB_TOKEN
gh auth login -p https -h github.com -w --scopes copilot,manage_billing:copilot,manage_billing:enterprise,read:enterprise,admin:org,codespace,repo
export VUE_APP_GITHUB_TOKEN=$(gh auth token)

npm run serve