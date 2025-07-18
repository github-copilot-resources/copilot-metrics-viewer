import { defineVuetifyConfiguration } from 'vuetify-nuxt-module/custom-configuration'

export default defineVuetifyConfiguration({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        dark: false,
        colors: {
          primary: '#3F51B5',
          secondary: '#7986CB',
          accent: '#536DFE',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FFA726',
          background: '#F5F7FA',
          surface: '#FFFFFF',
          'surface-variant': '#ECEFF1',
          'on-surface-variant': '#424242',
          'primary-darken-1': '#303F9F',
        },
      },
      dark: {
        dark: true,
        colors: {
          primary: '#5C6BC0',
          secondary: '#7986CB',
          accent: '#7C4DFF',
          error: '#EF5350',
          info: '#42A5F5',
          success: '#66BB6A',
          warning: '#FFA726',
          background: '#121212',
          surface: '#1E1E1E',
          'surface-variant': '#2D2D2D',
          'on-surface-variant': '#EEEEEE',
          'primary-darken-1': '#3949AB',
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