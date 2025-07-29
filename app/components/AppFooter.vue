<template>
  <v-footer class="app-footer">
    <v-container>
      <v-row>
        <v-col cols="12" md="4" class="d-flex flex-column">
          <div class="d-flex align-center mb-4">
            <v-icon color="primary" size="large" class="mr-2">mdi-github</v-icon>
            <h3 class="text-h6 font-weight-bold mb-0">Copilot Metrics Viewer</h3>
          </div>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Track your organization's GitHub Copilot usage, analyze trends, and optimize your development workflow.
          </p>
          <div class="d-flex align-center">
            <span class="text-caption text-medium-emphasis">Version {{ version }}</span>
          </div>
        </v-col>
        
        <v-col cols="12" md="4" class="d-flex flex-column align-center">
          <h4 class="text-subtitle-1 font-weight-bold mb-4">Quick Links</h4>
          <div class="d-flex flex-column">
            <a 
              href="https://github.com/github-copilot-resources/copilot-metrics-viewer" 
              target="_blank" 
              rel="noopener noreferrer"
              class="footer-link mb-2"
            >
              <v-icon size="small" class="mr-2">mdi-github</v-icon>
              GitHub Repository
            </a>
            <a 
              href="https://github.com/github-copilot-resources/copilot-metrics-viewer/issues" 
              target="_blank" 
              rel="noopener noreferrer"
              class="footer-link mb-2"
            >
              <v-icon size="small" class="mr-2">mdi-bug-outline</v-icon>
              Report an Issue
            </a>
            <a 
              href="https://github.com/github-copilot-resources/copilot-metrics-viewer/blob/main/README.md" 
              target="_blank" 
              rel="noopener noreferrer"
              class="footer-link"
            >
              <v-icon size="small" class="mr-2">mdi-file-document-outline</v-icon>
              Documentation
            </a>
          </div>
        </v-col>
        
        <v-col cols="12" md="4" class="d-flex flex-column align-md-end">
          <h4 class="text-subtitle-1 font-weight-bold mb-4">GitHub Copilot Resources</h4>
          <div class="d-flex flex-column align-md-end">
            <a 
              href="https://github.com/features/copilot" 
              target="_blank" 
              rel="noopener noreferrer"
              class="footer-link mb-2"
            >
              <v-icon size="small" class="mr-2">mdi-robot-outline</v-icon>
              GitHub Copilot
            </a>
            <a 
              href="https://docs.github.com/en/copilot" 
              target="_blank" 
              rel="noopener noreferrer"
              class="footer-link mb-2"
            >
              <v-icon size="small" class="mr-2">mdi-book-open-outline</v-icon>
              Copilot Documentation
            </a>
            <a 
              href="https://github.com/github-copilot-resources" 
              target="_blank" 
              rel="noopener noreferrer"
              class="footer-link"
            >
              <v-icon size="small" class="mr-2">mdi-source-repository</v-icon>
              More Resources
            </a>
          </div>
        </v-col>
      </v-row>
      
      <v-divider class="my-4"></v-divider>
      
      <div class="d-flex flex-column flex-md-row justify-space-between align-center">
        <div class="text-caption text-medium-emphasis mb-2 mb-md-0">
          {{ new Date().getFullYear() }} — <strong>Copilot Metrics Viewer</strong>
        </div>
        <div class="d-flex">
          <v-btn
            v-for="(icon, i) in socialIcons"
            :key="i"
            :href="icon.link"
            target="_blank"
            rel="noopener noreferrer"
            icon
            variant="text"
            size="small"
            class="mx-1"
          >
            <v-icon>{{ icon.icon }}</v-icon>
          </v-btn>
        </div>
      </div>
    </v-container>
  </v-footer>
</template>

<script setup lang="ts">
const config = useRuntimeConfig();
const version = computed(() => config.public.version);

const socialIcons = [
  { icon: 'mdi-github', link: 'https://github.com/github-copilot-resources/copilot-metrics-viewer' },
  { icon: 'mdi-twitter', link: 'https://twitter.com/github' },
  { icon: 'mdi-linkedin', link: 'https://www.linkedin.com/company/github' },
  { icon: 'mdi-youtube', link: 'https://www.youtube.com/github' }
];
</script>

<style scoped>
.app-footer {
  background-color: v-bind('$vuetify.theme.global.name === "dark" ? "rgba(18, 18, 18, 0.95)" : "rgba(255, 255, 255, 0.95)"');
  border-top: 1px solid v-bind('$vuetify.theme.global.name === "dark" ? "rgba(139, 233, 253, 0.1)" : "rgba(38, 166, 154, 0.1)"');
  padding: 48px 0 24px;
  position: relative;
  overflow: hidden;
}

.app-footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: v-bind('$vuetify.theme.global.name === "dark" ? "linear-gradient(90deg, #8BE9FD, #64D8CB, #9C64D8)" : "linear-gradient(90deg, #4DD0E1, #26A69A, #7B1FA2)"');
  opacity: 0.5;
}

.footer-link {
  display: flex;
  align-items: center;
  color: v-bind('$vuetify.theme.global.name === "dark" ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.7)"');
  text-decoration: none;
  transition: all 0.3s;
  font-size: 0.875rem;
}

.footer-link:hover {
  color: v-bind('$vuetify.theme.global.name === "dark" ? "#8BE9FD" : "#26A69A"');
  text-decoration: none;
  transform: translateX(5px);
}

.footer-link .v-icon {
  color: v-bind('$vuetify.theme.global.name === "dark" ? "#64D8CB" : "#26A69A"');
}

.text-h6 {
  background: v-bind('$vuetify.theme.global.name === "dark" ? "linear-gradient(90deg, #8BE9FD, #64D8CB)" : "linear-gradient(90deg, #4DD0E1, #26A69A)"');
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.text-subtitle-1 {
  color: v-bind('$vuetify.theme.global.name === "dark" ? "#8BE9FD" : "#26A69A"') !important;
}

@media (max-width: 768px) {
  .app-footer {
    padding: 32px 0 16px;
  }
  
  .v-col {
    margin-bottom: 24px;
  }
}
</style>