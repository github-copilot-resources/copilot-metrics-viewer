/**
 * Redirect /callback → /install, preserving all query parameters.
 *
 * GitHub App registrations with the Callback URL or Setup URL set to
 * /callback (the old route name) will land here. We forward everything to
 * the canonical /install page so the installation flow works without
 * requiring a change to the GitHub App settings.
 */
export default defineEventHandler((event) => {
  const query = getQuery(event)
  const qs = new URLSearchParams(query as Record<string, string>).toString()
  return sendRedirect(event, qs ? `/install?${qs}` : '/install', 302)
})
