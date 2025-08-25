/**
 * Basic Authentication Check Endpoint
 * 
 * This server endpoint handles HTTP Basic Authentication validation.
 * It prompts the browser for credentials and validates them against
 * the configured username/password from environment variables.
 * 
 * Security Features:
 * - Server-side credential validation
 * - HTTP 401 response triggers browser auth dialog
 * - Sets session flag for successful authentication
 * - Secure header parsing and validation
 * 
 * Flow:
 * 1. Browser receives 401 and shows basic auth dialog
 * 2. User enters credentials
 * 3. Server validates against environment variables
 * 4. On success: sets session flag and redirects to app
 * 5. On failure: returns 401 to prompt again
 */

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  
  // If basic auth is not enabled, redirect to home
  if (!config.public.basicAuthEnabled) {
    return sendRedirect(event, '/', 302)
  }

  const authHeader = getHeader(event, 'authorization')
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    // Prompt for basic authentication
    setHeader(event, 'WWW-Authenticate', 'Basic realm="Copilot Metrics Viewer"')
    setResponseStatus(event, 401)
    return 'Authentication required'
  }

  try {
    // Parse Basic Auth header
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8')
    const [username, password] = credentials.split(':')

    // Validate credentials against environment variables
    const validUsername = config.basicAuthUsername
    const validPassword = config.basicAuthPassword

    if (!validUsername || !validPassword) {
      console.error('Basic auth credentials not configured in environment')
      setResponseStatus(event, 500)
      return 'Authentication configuration error'
    }

    if (username === validUsername && password === validPassword) {
      // Authentication successful
      // Set a session cookie to remember the authentication state
      const sessionData = await useSession(event, {
        password: config.session.password
      })
      
      await sessionData.update({ basicAuthValid: true })

      // Return success response with script to set client-side flag and redirect
      setHeader(event, 'Content-Type', 'text/html')
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Successful</title>
        </head>
        <body>
          <script>
            sessionStorage.setItem('basicAuthValid', 'true');
            window.location.href = '/';
          </script>
          <p>Authentication successful. Redirecting...</p>
        </body>
        </html>
      `
    } else {
      // Invalid credentials
      setHeader(event, 'WWW-Authenticate', 'Basic realm="Copilot Metrics Viewer"')
      setResponseStatus(event, 401)
      return 'Invalid credentials'
    }
  } catch (error) {
    console.error('Error in basic auth validation:', error)
    setHeader(event, 'WWW-Authenticate', 'Basic realm="Copilot Metrics Viewer"')
    setResponseStatus(event, 401)
    return 'Authentication error'
  }
})
