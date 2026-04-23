// https://nuxt.com/docs/api/configuration/nuxt-config
import { readFileSync } from 'fs';
const packageJson = readFileSync('package.json', 'utf8');
const version = JSON.parse(packageJson).version;

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  future: {
    compatibilityVersion: 4
  },

  ssr: true,

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.svg' }
      ]
    }
  },

  // when enabling ssr option you need to disable inlineStyles and maybe devLogs
  features: {
    inlineStyles: false,
    devLogs: false,
  },

  build: {
    transpile: ['vuetify'],
  },

  vite: {
    ssr: {
      noExternal: ['vuetify'],
    },
  },

  css: [
    '@/assets/global.css'
  ],
  modules: ['@nuxt/fonts', 'vuetify-nuxt-module', '@nuxt/eslint', 'nuxt-auth-utils'],

  vuetify: {
    moduleOptions: {
      // check https://nuxt.vuetifyjs.com/guide/server-side-rendering.html
      ssrClientHints: {
        reloadOnFirstRequest: false,
        viewportSize: true,
        prefersColorScheme: false,

        prefersColorSchemeOptions: {
          useBrowserThemeOnly: false,
        },
      },

      // /* If customizing sass global variables ($utilities, $reset, $color-pack, $body-font-family, etc) */
      // disableVuetifyStyles: true,
      styles: {
        configFile: 'assets/settings.scss',
      },
    },
  },

  auth: {
    github: {
      enabled: true,
      clientId: '',
      clientSecret: ''
    }
  },
  nitro: {
    plugins: [
      'plugins/http-agent',
      'plugins/db-init',
    ],
    // Scheduled sync is handled by the dedicated sync Docker container (Dockerfile.sync).
    // Do not register scheduledTasks here to avoid Nitro "task not defined" warnings.
  },
  runtimeConfig: {
    githubToken: '',
    aiToken: '',  // Dedicated token for GitHub Models API (NUXT_AI_TOKEN). Falls back to githubToken.
    aiModel: 'gpt-4o',  // Model for AI chat (NUXT_AI_MODEL)
    aiMaxToolRounds: '5',  // Max tool-calling iterations (NUXT_AI_MAX_TOOL_ROUNDS)
    // GitHub App credentials (alternative to PAT — works with any OAuth provider)
    githubAppId: '',            // NUXT_GITHUB_APP_ID
    githubAppPrivateKey: '',    // NUXT_GITHUB_APP_PRIVATE_KEY (PEM, \n-escaped)
    githubAppInstallationId: '', // NUXT_GITHUB_APP_INSTALLATION_ID
    session: {
      // set to 6h - same as the GitHub token
      maxAge: 60 * 60 * 6,
      password: '',
    },
    oauth: {
      github: {
        clientId: '',
        clientSecret: ''
      },
      google: {
        clientId: '',
        clientSecret: ''
      },
      microsoft: {
        clientId: '',
        clientSecret: '',
        tenant: ''
      },
      auth0: {
        clientId: '',
        clientSecret: '',
        domain: ''
      },
      keycloak: {
        clientId: '',
        clientSecret: '',
        serverUrl: '',
        realm: ''
      }
    },
    // Server-only authorization config (NUXT_AUTHORIZED_USERS, NUXT_AUTHORIZED_EMAIL_DOMAINS)
    authorizedUsers: '',
    authorizedEmailDomains: '',
    public: {
      isDataMocked: false,  // can be overridden by NUXT_PUBLIC_IS_DATA_MOCKED environment variable
      scope: 'organization',  // can be overridden by NUXT_PUBLIC_SCOPE environment variable
      githubOrg: '',
      githubEnt: '',
      // Deprecated: use requireAuth + authProviders instead. Kept for backwards compatibility.
      usingGithubAuth: false,
      // Set to true when any OAuth provider is configured (NUXT_PUBLIC_REQUIRE_AUTH)
      requireAuth: false,
      // Comma-separated list of active OAuth providers shown in the UI, e.g. "github,google,microsoft"
      // (NUXT_PUBLIC_AUTH_PROVIDERS)
      authProviders: '',
      version,
      isPublicApp: false,
      // Deployment metadata (set via NUXT_PUBLIC_DEPLOY_INFO for preview environments)
      deployInfo: '',
      // New API migration flags
      useLegacyApi: false,  // Set true to use deprecated /copilot/metrics API (USE_LEGACY_API)
      enableHistoricalMode: false,  // Enable storage-backed historical queries (NUXT_PUBLIC_ENABLE_HISTORICAL_MODE)
      hiddenTabs: '',  // Comma-separated list of tab names to hide (NUXT_PUBLIC_HIDDEN_TABS)
      enableAiChat: true,  // Enable AI-powered chat for metrics Q&A (NUXT_PUBLIC_ENABLE_AI_CHAT)
    }
  }
})