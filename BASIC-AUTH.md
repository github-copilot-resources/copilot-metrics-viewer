# Basic Authentication Implementation

## Overview

This implementation adds HTTP Basic Authentication as an optional security layer for the Copilot Metrics Viewer. When enabled, users must provide valid credentials before accessing the application, in addition to any GitHub authentication requirements.

## Features

- **Optional Activation**: Basic auth can be enabled/disabled via environment variables
- **Browser Native**: Uses standard HTTP Basic Authentication with browser dialog
- **Session Management**: Remembers authentication state during session
- **Secure Storage**: Credentials stored securely in Azure Key Vault
- **Production Ready**: Designed for HTTPS deployment in Azure

## How It Works

### Authentication Flow

1. **Initial Access**: User visits the application
2. **Middleware Check**: Global middleware checks if basic auth is enabled
3. **Credential Prompt**: If enabled and not authenticated, browser shows login dialog
4. **Server Validation**: Credentials validated against environment variables
5. **Session Storage**: Valid authentication cached in session and client storage
6. **Application Access**: User proceeds to normal GitHub authentication flow

### Security Features

- **Server-Side Validation**: All credential checking happens on the server
- **Secure Headers**: Uses standard HTTP Basic Auth headers
- **Session Management**: Prevents repeated prompting during session
- **HTTPS Required**: Basic auth credentials encrypted in transit
- **Environment Isolation**: Different credentials per environment

## Configuration

### Environment Variables

Add these to your deployment configuration:

```bash
# Basic Authentication (Optional)
NUXT_BASIC_AUTH_USERNAME="your-username"
NUXT_BASIC_AUTH_PASSWORD="your-secure-password"
NUXT_PUBLIC_BASIC_AUTH_ENABLED="true"
```

### Azure Deployment

The Bicep templates automatically configure these environment variables when you provide the parameters:

```bash
# During azd up or deployment
az deployment group create \
  --resource-group GovInsights-DevCP-DEV-RG \
  --template-file infra/main.bicep \
  --parameters basicAuthUsername="admin" \
  --parameters basicAuthPassword="SecurePassword123!"
```

### Development Setup

For local development, create a `.env` file:

```env
NUXT_BASIC_AUTH_USERNAME=admin
NUXT_BASIC_AUTH_PASSWORD=devpassword
NUXT_PUBLIC_BASIC_AUTH_ENABLED=true
```

## Implementation Details

### Files Added/Modified

1. **Middleware**: `/middleware/01.basic-auth.global.ts`
   - Global route middleware that runs before all pages
   - Checks authentication state and redirects if needed

2. **API Endpoints**: 
   - `/server/api/auth/basic-auth-check.ts` - Handles credential validation
   - `/server/api/auth/session-check.ts` - Checks session authentication state

3. **Configuration**:
   - `nuxt.config.ts` - Added runtime config for basic auth
   - `infra/main.bicep` - Added parameters and environment variables
   - `infra/main.parameters.json` - Added parameter mappings

### Technical Implementation

```typescript
// Middleware checks authentication state
export default defineNuxtRouteMiddleware(async (_to, _from) => {
  const config = useRuntimeConfig()
  
  if (!config.public.basicAuthEnabled) return
  
  // Check client-side cache first
  const hasValidAuth = sessionStorage.getItem('basicAuthValid') === 'true'
  
  if (!hasValidAuth) {
    // Verify with server-side session
    const response = await $fetch('/api/auth/session-check')
    if (!response.data?.basicAuthValid) {
      return navigateTo('/api/auth/basic-auth-check', { external: true })
    }
  }
})
```

## Security Considerations

### Strengths
- **Defense in Depth**: Adds layer before GitHub authentication
- **Standard Protocol**: Uses well-established HTTP Basic Auth
- **Server Validation**: Credentials never stored client-side
- **Session Management**: Reduces authentication prompts

### Limitations
- **Simple Credentials**: Username/password only, no MFA
- **Shared Access**: Single credential set per environment
- **Browser Dependent**: Relies on browser basic auth dialog
- **HTTPS Required**: Credentials transmitted in headers

### Best Practices

1. **Use Strong Passwords**: Generate complex passwords for each environment
2. **Rotate Regularly**: Change credentials on schedule
3. **Environment Isolation**: Different credentials per environment
4. **Monitor Access**: Check logs for authentication failures
5. **HTTPS Only**: Never deploy without SSL/TLS

## Usage Scenarios

### Development Team Access
- **Use Case**: Restrict access to development/staging environments
- **Setup**: Enable basic auth with team-shared credentials
- **Benefit**: Prevents accidental public access during development

### Client Demos
- **Use Case**: Share controlled access with stakeholders
- **Setup**: Temporary credentials for demo environment
- **Benefit**: Professional presentation without GitHub setup

### Security Compliance
- **Use Case**: Meet organizational security requirements
- **Setup**: Enable as required security control
- **Benefit**: Satisfies basic access control policies

## Testing

### Manual Testing

1. **Enable Basic Auth**:
   ```bash
   export NUXT_BASIC_AUTH_USERNAME=testuser
   export NUXT_BASIC_AUTH_PASSWORD=testpass
   export NUXT_PUBLIC_BASIC_AUTH_ENABLED=true
   ```

2. **Start Application**:
   ```bash
   npm run dev
   ```

3. **Test Authentication**:
   - Visit application URL
   - Verify browser prompts for credentials
   - Test with correct/incorrect credentials
   - Verify session persistence

### Automated Testing

```javascript
// Example test case
describe('Basic Authentication', () => {
  it('should prompt for credentials when enabled', async () => {
    // Mock environment variables
    process.env.NUXT_PUBLIC_BASIC_AUTH_ENABLED = 'true'
    
    // Test unauthorized access
    const response = await fetch('/api/auth/basic-auth-check')
    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toContain('Basic')
  })
})
```

## Troubleshooting

### Common Issues

1. **Credentials Not Working**:
   - Check environment variable names and values
   - Verify deployment configuration
   - Check Azure Key Vault access permissions

2. **Repeated Prompts**:
   - Clear browser cache and session storage
   - Check session configuration in nuxt.config.ts
   - Verify HTTPS deployment

3. **Browser Compatibility**:
   - Modern browsers support basic auth
   - Some corporate firewalls may interfere
   - Test in incognito/private mode

### Debug Mode

Enable detailed logging:

```typescript
// Add to server/api/auth/basic-auth-check.ts
console.log('Basic auth attempt:', {
  hasAuthHeader: !!authHeader,
  configEnabled: config.public.basicAuthEnabled,
  timestamp: new Date().toISOString()
})
```

## Deployment Checklist

- [ ] Configure basic auth credentials in Azure Key Vault
- [ ] Set environment variables in Bicep parameters
- [ ] Test authentication flow in staging
- [ ] Verify HTTPS deployment
- [ ] Document credentials for team access
- [ ] Set up credential rotation schedule
- [ ] Monitor authentication logs

## Future Enhancements

Potential improvements for enhanced security:

1. **Multi-Factor Authentication**: Add TOTP/SMS verification
2. **IP Restrictions**: Combine with IP allowlisting
3. **Rate Limiting**: Prevent brute force attempts
4. **Audit Logging**: Enhanced authentication logging
5. **Role-Based Access**: Different credentials for different access levels
6. **SSO Integration**: Replace with corporate SSO solution
