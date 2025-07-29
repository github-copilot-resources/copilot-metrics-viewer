import { defineVuetifyConfiguration } from 'vuetify-nuxt-module/custom-configuration'

export default defineVuetifyConfiguration({
  theme: {
    defaultTheme: 'dark',
    themes: {
      light: {
        dark: false,
        colors: {
          primary: '#26A69A',
          secondary: '#4DD0E1',
          accent: '#7B1FA2',
          error: '#F44336',
          info: '#4DD0E1',
          success: '#4CAF50',
          warning: '#FF9800',
          background: '#F5F7FA',
          surface: '#FFFFFF',
          'surface-variant': '#ECEFF1',
          'on-surface-variant': '#424242',
          'primary-darken-1': '#00897B',
          'accent-darken-1': '#6A1B9A',
          'secondary-darken-1': '#00ACC1',
        },
      },
      dark: {
        dark: true,
        colors: {
          primary: '#64D8CB',
          secondary: '#8BE9FD',
          accent: '#9C64D8',
          error: '#FF5252',
          info: '#8BE9FD',
          success: '#50FA7B',
          warning: '#FFB86C',
          background: '#121212',
          surface: '#1E1E1E',
          'surface-variant': '#2D2D2D',
          'on-surface-variant': '#EEEEEE',
          'primary-darken-1': '#26A69A',
          'accent-darken-1': '#7B1FA2',
          'secondary-darken-1': '#4DD0E1',
        },
      },
    },
  },
  defaults: {
    VCard: {
      elevation: 2,
      rounded: 'lg',
    },
    VBtn: {
      rounded: 'md',
      variant: 'elevated',
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
    },
    VToolbar: {
      elevation: 2,
    },
  },
})