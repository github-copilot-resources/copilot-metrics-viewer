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

  css: ['~/assets/global.css', '~/assets/light-theme.css', '~/assets/background.css', '~/assets/date-range-fix.css', '~/assets/data-table-fix.css', '~/assets/data-table-fix-v2.css', '~/assets/data-table-fix-v3.css', '~/assets/vuetify-fix.css', '~/assets/dropdown-fix.css', '~/assets/final-fix.css', '~/assets/direct-fix.css', '~/assets/dropdown-direct-fix.css'],
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
    ],
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
      defaultTheme: 'dark',  // can be overridden by NUXT_PUBLIC_DEFAULT_THEME environment variable
      version,
      isPublicApp: false
    }
  }
})