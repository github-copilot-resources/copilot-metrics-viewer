import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Read the MSAL redirect bridge at startup (6KB UMD bundle, handles popup postMessage flow)
let bridgeScript = ''
try {
  bridgeScript = readFileSync(
    resolve(process.cwd(), 'node_modules/@azure/msal-browser/lib/redirect-bridge/msal-redirect-bridge.min.js'),
    'utf-8'
  )
} catch {
  // Fallback: bridge unavailable; popup will time out gracefully
}

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Authenticating…</title>
</head>
<body>
<script>
${bridgeScript}
</script>
<script>
  if (typeof msalRedirectBridge !== 'undefined') {
    msalRedirectBridge.broadcastResponseToMainFrame().catch(function() {});
  }
</script>
</body>
</html>`

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  // No caching — this page must be fresh on every auth attempt
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return html
})
