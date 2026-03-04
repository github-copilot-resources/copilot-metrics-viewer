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
    scheduledTasks: {
      // Daily sync task - runs at 2 AM by default
      // Customize schedule via SYNC_SCHEDULE env var (cron format)
      [process.env.SYNC_SCHEDULE ?? '0 2 * * *']: ['daily-metrics-sync']
    }
  },
  runtimeConfig: {
    githubToken: '',
    session: {
      // set to 6h - same as the GitHub token
      maxAge: 60 * 60 * 6,
      password: '',
    },
    oauth: {
      github: {
        clientId: '',
        clientSecret: ''
      }
    },
    public: {
      isDataMocked: false,  // can be overridden by NUXT_PUBLIC_IS_DATA_MOCKED environment variable
      scope: 'organization',  // can be overridden by NUXT_PUBLIC_SCOPE environment variable
      githubOrg: '',
      githubEnt: '',
      githubTeam: '',
      usingGithubAuth: false,
      version,
      isPublicApp: false,
      // New API migration flags
      useLegacyApi: false,  // Set true to use deprecated /copilot/metrics API (USE_LEGACY_API)
      enableHistoricalMode: false  // Enable storage-backed historical queries (NUXT_PUBLIC_ENABLE_HISTORICAL_MODE)
    }
  }
})