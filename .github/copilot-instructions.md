# GitHub Copilot Metrics Viewer

GitHub Copilot Metrics Viewer is a Nuxt 3 web application that displays GitHub Copilot usage metrics and analytics for organizations and enterprises. The application visualizes data from the GitHub Copilot Metrics API using Vue.js, TypeScript, Vuetify, and Chart.js.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Initial Setup
- **Node.js requirement**: Uses Node.js 20+ (verified: v20.19.4 works)
- Install dependencies: `npm install` 
  - **NEVER CANCEL**: Takes 3 minutes to complete. Set timeout to 5+ minutes.
  - Includes postinstall script that runs `nuxt prepare`

### Build and Development
- **Development server**: `npm run dev`
  - Starts on http://localhost:3000/
  - **Font provider warnings are normal** - application works despite "Could not fetch fonts" errors
  - Supports hot reload and auto-refresh
- **Production build**: `npm run build`
  - **NEVER CANCEL**: Takes 30 seconds to complete. Set timeout to 2+ minutes.
  - Builds successfully despite font provider connection warnings
  - Outputs to `.output/` directory
- **Production preview**: Built server requires proper environment setup
  - After build: `NUXT_SESSION_PASSWORD=something_long_and_random_thats_at_least_32_characters node .output/server/index.mjs`
  - **NOTE**: Health endpoints may not work correctly in built mode in some environments
  - **Recommendation**: Use `npm run dev` for development and testing validation scenarios

### Testing
- **Unit tests**: `npm test` (using Vitest)
  - **NEVER CANCEL**: Takes 15 seconds to complete. Set timeout to 2+ minutes.
  - Runs 83 tests, all should pass
  - Uses mocked data environment
- **E2E tests**: `npm run test:e2e` (using Playwright)
  - **NOTE**: Playwright browser installation may fail in some environments due to download issues
  - Install browsers first: `npx playwright install` 
  - Uses mocked data for testing
- **Type checking**: `npm run typecheck`
  - **KNOWN ISSUE**: Currently fails with 18 TypeScript errors
  - Takes 10 seconds to complete
  - Errors are in existing codebase, not blocking for development

### Code Quality
- **Linting**: `npm run lint`
  - **KNOWN ISSUE**: Currently fails with 43 ESLint errors (mostly @typescript-eslint/no-explicit-any)
  - Takes 3 seconds to complete
  - `npm run lint:fix` can fix some formatting issues but not the core errors
  - **Always run linting** but expect failures in current codebase

## Environment Configuration

### Required Environment Variables
- **NUXT_SESSION_PASSWORD**: Required, minimum 32 characters
  - Used for session encryption
  - Example: `NUXT_SESSION_PASSWORD=something_long_and_random_thats_at_least_32_characters`

### GitHub Integration
- **Mock mode (default)**: `NUXT_PUBLIC_IS_DATA_MOCKED=true`
  - Works without GitHub tokens
  - Uses sample data for development and testing
- **Real GitHub data**: Requires GitHub Personal Access Token
  - `NUXT_GITHUB_TOKEN=<your_token>`
  - Token needs scopes: copilot, manage_billing:copilot, manage_billing:enterprise, read:enterprise, read:org

### Scope Configuration
- **NUXT_PUBLIC_SCOPE**: Sets default scope ('organization', 'enterprise', 'team-organization', 'team-enterprise')
- **NUXT_PUBLIC_GITHUB_ORG**: Target organization name
- **NUXT_PUBLIC_GITHUB_ENT**: Target enterprise name
- **NUXT_PUBLIC_GITHUB_TEAM**: Target team name (optional)

### OAuth Configuration (Optional)
- **NUXT_PUBLIC_USING_GITHUB_AUTH**: Enable GitHub OAuth (default: false)
- **NUXT_OAUTH_GITHUB_CLIENT_ID**: GitHub App client ID
- **NUXT_OAUTH_GITHUB_CLIENT_SECRET**: GitHub App client secret

## Validation

### Manual Testing Scenarios
Always test these scenarios after making changes (use development mode for reliable validation):

1. **Health Check Endpoints** (use dev server: `npm run dev`):
   - Test: `curl http://localhost:3000/api/health`
   - Expected: JSON response with status, timestamp, version, uptime
   - Test: `curl http://localhost:3000/api/ready`
   - Expected: JSON response with status, checks object
   - Test: `curl http://localhost:3000/api/live`
   - Expected: JSON response with status, memory usage, process info

2. **Mock Data Functionality**:
   - Start dev server: `npm run dev`
   - Navigate to: http://localhost:3000/orgs/mocked-org?mock=true
   - Verify: Page loads showing metrics dashboard with charts
   - Test language breakdown, seat analysis, and chat metrics tabs

3. **Different Scope URLs**:
   - Organizations: `http://localhost:3000/orgs/octodemo`
   - Enterprises: `http://localhost:3000/enterprises/octo-demo-ent`
   - Teams: `http://localhost:3000/orgs/octodemo/teams/the-a-team`

### Docker Support
- **Build**: `docker build -t copilot-metrics-viewer .`
  - **NOTE**: May fail in environments with certificate/proxy issues
  - Uses multi-stage build with Node.js Alpine images
- **Playwright mode**: `docker build -t copilot-metrics-pw --build-arg mode=playwright .`
- **Run**: See DEPLOYMENT.md for full Docker configuration examples

### Always Run Before Committing
1. **Build verification**: `npm run build` - Must complete successfully
2. **Unit tests**: `npm test` - All 83 tests must pass
3. **Basic functionality**: Start dev server and verify health endpoints respond
4. **Linting awareness**: Run `npm run lint` (expect existing errors, don't introduce new ones)

## Common Tasks

### Repo Structure
```
├── app/                 # Vue.js application source
│   ├── components/      # Vue components (MetricsViewer, SeatsAnalysisViewer, etc.)
│   ├── pages/          # Nuxt pages (index.vue)
│   ├── model/          # TypeScript data models
│   └── utils/          # Utility functions
├── server/             # Nuxt server-side code
│   ├── api/            # API endpoints (health.ts, metrics.ts, seats.ts)
│   ├── routes/         # Server routes (auth)
│   └── plugins/        # Server plugins (http-agent.ts)
├── tests/              # Unit tests (Vitest)
├── e2e-tests/          # End-to-end tests (Playwright)
├── .env                # Environment configuration
├── nuxt.config.ts      # Nuxt configuration
├── package.json        # Dependencies and scripts
└── Dockerfile          # Container configuration
```

### Key Files to Monitor
- **Health endpoints**: `/server/api/health.ts`, `/server/api/ready.ts`, `/server/api/live.ts`
- **Main metrics logic**: `/server/api/metrics.ts`, `/server/api/seats.ts`
- **Frontend components**: `/app/components/MetricsViewer.vue`, `/app/components/MainComponent.vue`
- **Configuration**: `/nuxt.config.ts`, `/.env`

### Debugging Tips
- **Font provider warnings**: Normal in restricted network environments, application functions correctly
- **Mock data**: Use `?mock=true` query parameter for testing without GitHub tokens
- **API debugging**: Check browser network tab for API call responses
- **Server logs**: Development server shows detailed request logs and errors

### Performance Notes
- **Development startup**: ~10 seconds with font provider retries
- **Build time**: ~30 seconds
- **Test execution**: ~15 seconds for full unit test suite
- **Hot reload**: Very fast in development mode

## Known Limitations
- **Linting**: 43 existing ESLint errors in codebase (mostly TypeScript any types)
- **Type checking**: 18 existing TypeScript errors 
- **Playwright**: Browser installation may fail in restricted environments
- **Docker**: Build may fail in environments with certificate/proxy restrictions
- **Font providers**: External font API calls fail in restricted networks (non-blocking)

Always validate your changes work in mock mode first, then test with real GitHub data if available.