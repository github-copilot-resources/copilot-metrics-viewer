import type { H3Event, EventHandlerRequest } from 'h3'

/**
 * Check if a user is authorized to access the application.
 * 
 * @param event H3 event object
 * @param username Username to check authorization for
 * @returns true if user is authorized, false otherwise
 */
export function isUserAuthorized(event: H3Event<EventHandlerRequest>, username: string): boolean {
  const config = useRuntimeConfig(event)
  
  // If no authorized users list is configured, allow all authenticated users
  if (!config.authorizedUsers || config.authorizedUsers.trim() === '') {
    return true
  }

  // Parse the comma-separated list of authorized users
  const authorizedUsers = config.authorizedUsers
    .split(',')
    .map(user => user.trim().toLowerCase())
    .filter(user => user.length > 0)

  // If no valid users after processing, allow all
  if (authorizedUsers.length === 0) {
    return true
  }

  // Check if the user is in the authorized list (case-insensitive)
  return authorizedUsers.includes(username.toLowerCase())
}

/**
 * Authorization middleware that checks if the current user is authorized.
 * Throws an error if the user is not authorized.
 * 
 * @param event H3 event object
 */
export async function requireAuthorization(event: H3Event<EventHandlerRequest>): Promise<void> {
  const { user } = await getUserSession(event)
  
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  }

  // Check user authorization
  const username = user.login || user.name || user.githubId?.toString()
  if (!username) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unable to determine user identity'
    })
  }

  if (!isUserAuthorized(event, username)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Access denied. User not authorized to access this application.'
    })
  }
}