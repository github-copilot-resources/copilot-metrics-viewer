# Basic Authentication Testing Guide

## Quick Testing Steps

### 1. Local Development Testing

```bash
# Set up local environment with basic auth
export NUXT_BASIC_AUTH_USERNAME=testuser
export NUXT_BASIC_AUTH_PASSWORD=testpass
export NUXT_PUBLIC_BASIC_AUTH_ENABLED=true

# Start the development server
npm run dev
```

### 2. Test Authentication Flow

1. **Open Browser**: Navigate to `http://localhost:3000`
2. **Authentication Dialog**: Browser should show basic auth dialog
3. **Test Credentials**:
   - Enter: `testuser` / `testpass` (should succeed)
   - Enter: wrong credentials (should fail and re-prompt)
4. **Session Persistence**: After successful auth, refresh page - should not re-prompt
5. **Clear Session**: Clear browser data or use incognito - should re-prompt

### 3. Production Testing

```bash
# Deploy with basic auth enabled
azd env set NUXT_BASIC_AUTH_USERNAME "admin"
azd env set NUXT_BASIC_AUTH_PASSWORD "SecurePassword123!"
azd up

# Test the deployed application
curl -i https://your-app-url.azurewebsites.net/
# Should return 401 with WWW-Authenticate header

curl -u admin:SecurePassword123! https://your-app-url.azurewebsites.net/
# Should return successful response
```

### 4. Disable Basic Auth

```bash
# Remove basic auth environment variables
azd env unset NUXT_BASIC_AUTH_USERNAME
azd env unset NUXT_BASIC_AUTH_PASSWORD

# Redeploy
azd up
```

## Testing Scenarios

### Scenario 1: Development Environment
- **Goal**: Restrict access during development
- **Setup**: Enable basic auth with team credentials
- **Test**: Verify team members can access, others cannot

### Scenario 2: Staging/Demo Environment  
- **Goal**: Controlled access for stakeholders
- **Setup**: Temporary basic auth credentials
- **Test**: Share credentials for demo access

### Scenario 3: Production Environment
- **Goal**: Additional security layer
- **Setup**: Strong credentials stored in Key Vault
- **Test**: Verify both basic auth and GitHub auth work together

## Expected Behavior

### With Basic Auth Enabled:
1. User visits application
2. Browser prompts for username/password
3. Invalid credentials → Re-prompt
4. Valid credentials → Proceed to GitHub auth flow
5. Session remembered until browser closed

### With Basic Auth Disabled:
1. User visits application
2. Directly proceeds to GitHub auth flow
3. No additional authentication prompts

## Troubleshooting Tests

### Issue: Browser Doesn't Prompt
- **Check**: Environment variables are set correctly
- **Check**: Application restarted after environment changes
- **Try**: Clear browser cache and cookies

### Issue: Credentials Don't Work
- **Check**: Exact username/password values
- **Check**: No extra spaces or special characters
- **Check**: Server logs for authentication attempts

### Issue: Repeated Prompts
- **Check**: Session configuration in nuxt.config.ts
- **Check**: Browser accepts cookies
- **Check**: HTTPS in production (required for sessions)

## Security Testing

### Test Invalid Scenarios:
1. **No Credentials**: Should return 401
2. **Wrong Username**: Should return 401
3. **Wrong Password**: Should return 401
4. **Empty Credentials**: Should return 401

### Test Session Security:
1. **Session Expiry**: Test after configured session timeout
2. **Browser Close**: Should require re-authentication
3. **Incognito Mode**: Should always prompt

### Performance Testing:
1. **Multiple Users**: Verify concurrent authentication
2. **Load Testing**: Ensure auth doesn't slow down application
3. **Memory Usage**: Check session storage efficiency
