/**
 * Session Check Endpoint
 * 
 * This endpoint checks if the current session has valid basic authentication.
 * Used by the client-side middleware to verify authentication state.
 */

export default defineEventHandler(async (event) => {
  try {
    const sessionData = await useSession(event, {
      password: useRuntimeConfig(event).session.password
    })
    
    return {
      success: true,
      data: {
        basicAuthValid: sessionData.data.basicAuthValid || false
      }
    }
  } catch {
    return {
      success: false,
      data: {
        basicAuthValid: false
      }
    }
  }
})
