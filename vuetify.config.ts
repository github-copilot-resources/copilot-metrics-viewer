import { defineVuetifyConfiguration } from 'vuetify-nuxt-module/custom-configuration'

export default defineVuetifyConfiguration({
  // your Vuetify options here
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1976D2',
          secondary: '#424242',
          accent: '#82B1FF',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FFC107',
          surface: '#FFFFFF',
          'surface-variant': '#F5F5F5',
        },
      },
      dark: {
        dark: true,
        colors: {
          primary: '#90CAF9',
          secondary: '#B0BEC5',
          accent: '#82B1FF',
          error: '#EF9A9A',
          info: '#64B5F6',
          success: '#A5D6A7',
          warning: '#FFE082',
          surface: '#1E1E1E',
          'surface-variant': '#2D2D2D',
          background: '#121212',
        },
      },
    },
  },
})
