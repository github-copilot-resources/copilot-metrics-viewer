// Self-contained MSAL popup bridge.
// Reads the auth response from the popup's URL, sends it to the main window
// via BroadcastChannel (matching MSAL 5.x's popup handling), and closes the window.
// Fallback: if window.close() is blocked (pop-up was opened in main tab),
// redirect back to the app root so the user isn't stranded.
const BRIDGE_SCRIPT = `
(function () {
  function decodeBase64Url(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return atob(s);
  }

  function getResponse() {
    var hash = window.location.hash;
    var query = window.location.search;
    var payload = '', state = null;
    if (hash && hash.length > 1) {
      var h = hash.slice(1);
      var p = new URLSearchParams(h);
      if (p.has('state')) { payload = h; state = p.get('state'); }
    }
    if (!state && query && query.length > 1) {
      var q = query.slice(1);
      var p2 = new URLSearchParams(q);
      if (p2.has('state')) { payload = q; state = p2.get('state'); }
    }
    return { payload: payload, state: state };
  }

  try {
    var r = getResponse();
    if (r.state) {
      var parts = r.state.split('|');
      var lib = JSON.parse(decodeBase64Url(parts[0]));
      if (lib && lib.id) {
        var ch = new BroadcastChannel(lib.id);
        ch.postMessage({ v: 1, payload: r.payload });
        ch.close();
      }
    }
  } catch (e) { /* ignore parse errors */ }

  try { window.close(); } catch (e) {}

  // If window.close() was blocked (e.g. browser policy), navigate home
  // so the user isn't stranded on the raw callback URL.
  setTimeout(function () {
    try {
      if (!window.closed) {
        window.location.replace(window.location.origin + '/');
      }
    } catch (e) {}
  }, 800);
})();
`

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Authenticating…</title>
</head>
<body>
<script>${BRIDGE_SCRIPT}<\/script>
</body>
</html>`

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  // No caching — this page must be fresh on every auth attempt
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return html
})
