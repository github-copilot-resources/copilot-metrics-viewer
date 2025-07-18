import { defineVuetifyConfiguration } from 'vuetify-nuxt-module/custom-configuration'

export default defineVuetifyConfiguration({
  // your Vuetify options here
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          // Keep existing Vuetify colors but add custom hover states
          primary: '#1976D2',
          secondary: '#424242',
          accent: '#82B1FF',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FFC107',
          // Custom surface colors for better hover effects
          surface: '#FFFFFF',
          'surface-variant': '#F5F5F5',
        },
      },
    },
  },
})
