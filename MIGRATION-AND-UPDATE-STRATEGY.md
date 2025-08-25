# Migration and Update Strategy

This document outlines the comprehensive strategy for migrating the GitHub Copilot Metrics Viewer to a new organization repository while preserving customizations and maintaining synchronization with the upstream repository.

## Table of Contents
- [Project Overview](#project-overview)
- [Completed Enhancements](#completed-enhancements)
- [Migration Strategy](#migration-strategy)
- [Update Workflow](#update-workflow)
- [Branch Strategy](#branch-strategy)
- [Executive Metrics Roadmap](#executive-metrics-roadmap)
- [Security Considerations](#security-considerations)
- [Maintenance Guidelines](#maintenance-guidelines)

## Project Overview

The GitHub Copilot Metrics Viewer has been enhanced with:
- Azure-compliant resource naming conventions
- HTTP Basic Authentication for security
- Enhanced documentation and deployment guides
- Foundation for executive-level metrics and dashboards

## Completed Enhancements

### 1. Azure Resource Naming
- **Files Modified**: `infra/main.bicep`, `infra/main.parameters.json`
- **Changes**: Implemented Azure-compliant naming with string interpolation
- **Benefits**: Consistent, predictable resource names that follow Azure best practices

### 2. HTTP Basic Authentication
- **Files Created/Modified**:
  - `app/middleware/01.basic-auth.global.ts` - Authentication middleware
  - `server/api/auth/basic-auth-check.ts` - Auth validation endpoint
  - `server/api/auth/session-check.ts` - Session verification endpoint
  - `nuxt.config.ts` - Runtime configuration
  - `.env`, `.env.example` - Environment configuration
- **Security Features**:
  - Global middleware protection
  - Configurable authentication toggle
  - Secure credential handling
  - Session management

### 3. Enhanced Documentation
- **Files Created/Updated**:
  - `BASIC-AUTH.md` - Authentication setup and usage guide
  - `AI-Instructions.md` - Development and deployment instructions
  - `README.md` - Updated with security and deployment information
  - `.env.example` - Configuration template

### 4. Infrastructure Improvements
- **Bicep Templates**: Updated with basic auth environment variables
- **Azure Deployment**: Ready for production deployment with authentication
- **Security**: Environment variable management and secure defaults

## Migration Strategy

### Phase 1: Repository Setup

1. **Create New Organization Repository**
   ```bash
   # In your organization
   git clone https://github.com/github-copilot-resources/copilot-metrics-viewer.git copilot-metrics-viewer
   cd copilot-metrics-viewer
   git remote rename origin upstream
   git remote add origin https://github.com/AvenuProducts/copilot-metrics-viewer.git
   ```

2. **Apply Custom Changes**
   ```bash
   # Create and switch to customization branch
   git checkout -b org-customizations
   
   # Apply all the enhancements from this project
   # (Copy files from current enhanced version)
   
   git add .
   git commit -m "feat: Add organization customizations
   
   - Azure-compliant resource naming
   - HTTP Basic Authentication
   - Enhanced documentation
   - Executive metrics foundation"
   
   git push -u origin org-customizations
   ```

### Phase 2: Main Branch Setup

1. **Merge Customizations**
   ```bash
   git checkout main
   git merge org-customizations
   git push -u origin main
   ```

2. **Set Default Branch Protection**
   - Enable branch protection on `main`
   - Require pull request reviews
   - Require status checks
   - Restrict pushes to main

## Update Workflow

### Regular Upstream Sync

1. **Monthly Update Check**
   ```bash
   # Fetch latest upstream changes
   git fetch upstream
   
   # Check for new releases
   git log --oneline main..upstream/main
   ```

2. **Create Update Branch**
   ```bash
   # Create update branch from upstream
   git checkout -b upstream-sync-$(date +%Y-%m-%d) upstream/main
   
   # Cherry-pick or merge customizations
   git cherry-pick <customization-commits>
   # OR
   git merge org-customizations
   ```

3. **Test and Validate**
   ```bash
   # Install dependencies
   npm install
   
   # Run tests
   npm test
   npm run test:e2e
   
   # Test local deployment
   npm run dev
   
   # Test basic auth functionality
   # Test metrics endpoints
   ```

4. **Create Pull Request**
   - Open PR from update branch to `main`
   - Include changelog of upstream updates
   - Verify all custom features still work
   - Deploy to staging environment for testing

## Branch Strategy

### Core Branches

- **`main`**: Production-ready code with customizations
- **`org-customizations`**: Permanent branch for organization-specific features
- **`upstream-sync-YYYY-MM-DD`**: Temporary branches for upstream updates

### Feature Development

```bash
# For new organization features
git checkout -b feature/executive-dashboard org-customizations
# Develop feature
git push -u origin feature/executive-dashboard
# PR to org-customizations

# For bug fixes
git checkout -b fix/auth-issue main
# Fix issue
git push -u origin fix/auth-issue
# PR to main
```

### Conflict Resolution Strategy

1. **Identify Conflict Areas**
   - Configuration files (`nuxt.config.ts`, `package.json`)
   - Infrastructure files (`infra/main.bicep`)
   - Documentation files (`README.md`)

2. **Resolution Approach**
   - Keep upstream changes for core functionality
   - Preserve customizations for authentication and naming
   - Update documentation to reflect both sets of changes

3. **Testing Protocol**
   - Functional testing of all custom features
   - Integration testing with upstream changes
   - Security testing for authentication
   - Azure deployment testing

## Executive Metrics Roadmap

### Available via GitHub API (Quick Wins)

1. **Seat Utilization Dashboard**
   - Active vs. total seats
   - Utilization trends over time
   - Cost per active user

2. **Team Performance Metrics**
   - Acceptance rates by team/organization
   - Lines of code suggested vs. accepted
   - Language-specific adoption

3. **ROI Analysis**
   - Code generation efficiency
   - Time saved estimates
   - Productivity metrics

### Custom Analytics (Future Development)

1. **Advanced Reporting**
   - Custom time range analysis
   - Comparative team performance
   - Trend analysis and forecasting

2. **Integration Capabilities**
   - Export to BI tools
   - API endpoints for custom dashboards
   - Automated reporting

### Implementation Plan

1. **Phase 1**: Implement basic executive endpoints
   ```
   server/api/enhanced/
   ├── seat-utilization.ts
   ├── team-performance.ts
   └── roi-analysis.ts
   ```

2. **Phase 2**: Create dashboard components
   ```
   components/enhanced/
   ├── ExecutiveDashboard.vue
   ├── SeatUtilizationWidget.vue
   └── TeamPerformanceWidget.vue
   ```

3. **Phase 3**: Add export and integration features

## Security Considerations

### Authentication Management

1. **Password Policy**
   - Use strong, memorable passwords (recommended format provided)
   - Regular password rotation
   - Secure environment variable management

2. **Environment Variables**
   ```bash
   # Required for basic auth
   BASIC_AUTH_ENABLED=true
   BASIC_AUTH_USERNAME=admin
   BASIC_AUTH_PASSWORD=your-secure-password
   ```

3. **Azure Deployment Security**
   - Store credentials in Azure Key Vault
   - Use managed identities where possible
   - Regular security audits

### Access Control

1. **Repository Access**
   - Limit write access to main branch
   - Require code reviews for all changes
   - Use branch protection rules

2. **Deployment Security**
   - Separate staging and production environments
   - Secure CI/CD pipeline configuration
   - Regular dependency updates

## Maintenance Guidelines

### Weekly Tasks
- [ ] Check for security updates in dependencies
- [ ] Review access logs (if available)
- [ ] Monitor application performance

### Monthly Tasks
- [ ] Check for upstream updates
- [ ] Review and update documentation
- [ ] Test backup and recovery procedures
- [ ] Security scan of dependencies

### Quarterly Tasks
- [ ] Full security audit
- [ ] Performance optimization review
- [ ] Update Azure resource configurations
- [ ] Review and update authentication credentials

### Annual Tasks
- [ ] Comprehensive security review
- [ ] Disaster recovery testing
- [ ] Architecture review and optimization
- [ ] Training update for team members

## Automated Workflow (Optional)

### GitHub Actions for Upstream Sync

Create `.github/workflows/upstream-sync.yml`:

```yaml
name: Upstream Sync Check
on:
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday
  workflow_dispatch:

jobs:
  check-upstream:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Add upstream remote
        run: git remote add upstream https://github.com/github/copilot-metrics-viewer.git
      
      - name: Fetch upstream
        run: git fetch upstream
      
      - name: Check for updates
        run: |
          COMMITS=$(git log --oneline main..upstream/main | wc -l)
          if [ $COMMITS -gt 0 ]; then
            echo "::notice::$COMMITS new commits available from upstream"
            echo "commits=$COMMITS" >> $GITHUB_OUTPUT
          fi
        id: check
      
      - name: Create issue for updates
        if: steps.check.outputs.commits > 0
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Upstream Updates Available',
              body: `${context.payload.check.outputs.commits} new commits are available from upstream. Please review and create an update branch.`
            })
```

## Troubleshooting

## Troubleshooting

### Git Setup Issues

1. **Repository Not Found Error**
   ```bash
   # Error: remote: Repository not found
   # Solution: Verify organization name and repository exists
   git remote -v  # Check current remotes
   git remote set-url origin https://github.com/AvenuProducts/copilot-metrics-viewer.git
   ```

2. **Authentication Failures**
   ```bash
   # Error: Permission denied (publickey) or 403 Forbidden
   # Solution: Check GitHub authentication
   
   # For SSH (recommended)
   ssh -T git@github.com
   
   # For HTTPS with token
   git config --global credential.helper store
   # Then enter your GitHub token when prompted
   ```

3. **Branch Tracking Issues**
   ```bash
   # Error: no upstream branch
   # Solution: Set upstream tracking
   git branch --set-upstream-to=origin/main main
   git branch --set-upstream-to=origin/org-customizations org-customizations
   ```

4. **Remote Configuration Check**
   ```bash
   # Verify correct remote setup
   git remote -v
   # Should show:
   # origin    https://github.com/AvenuProducts/copilot-metrics-viewer.git (fetch)
   # origin    https://github.com/AvenuProducts/copilot-metrics-viewer.git (push)
   # upstream  https://github.com/github-copilot-resources/copilot-metrics-viewer.git (fetch)
   # upstream  https://github.com/github-copilot-resources/copilot-metrics-viewer.git (push)
   ```

5. **Migration Verification Checklist**
   ```bash
   # After completing migration setup, verify:
   
   # 1. Check repository structure
   ls -la  # Should see all project files
   
   # 2. Verify remote configuration
   git remote -v
   
   # 3. Check branch setup
   git branch -a
   
   # 4. Test upstream connectivity
   git fetch upstream --dry-run
   
   # 5. Verify environment configuration
   cat .env.example  # Should show AvenuProducts-specific variables
   
   # 6. Test local development
   npm install
   npm run dev
   
   # 7. Verify authentication works
   # Visit http://localhost:3000 and test basic auth
   ```

### Common Migration Issues

1. **Merge Conflicts During Updates**
   - Focus on preserving authentication logic
   - Keep Azure naming conventions
   - Update documentation carefully

2. **Authentication Issues**
   - Verify environment variables are set
   - Check middleware execution order
   - Validate credential format

3. **Azure Deployment Issues**
   - Verify Bicep template syntax
   - Check parameter file values
   - Validate Azure resource naming

### Support Resources

- **Internal Documentation**: This file and `BASIC-AUTH.md`
- **Upstream Repository**: https://github.com/github/copilot-metrics-viewer
- **Azure Documentation**: Azure App Service and Bicep resources
- **Nuxt Documentation**: For framework-specific issues

---

**Document Version**: 1.0  
**Last Updated**: July 11, 2025  
**Next Review**: August 11, 2025
