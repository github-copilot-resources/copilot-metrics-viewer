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
  background-color: var(--v-theme-surface);
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  padding: 48px 0 24px;
}

.footer-link {
  display: flex;
  align-items: center;
  color: var(--v-theme-on-surface-variant);
  text-decoration: none;
  transition: color 0.3s;
  font-size: 0.875rem;
}

.footer-link:hover {
  color: var(--v-theme-primary);
  text-decoration: none;
}

.v-theme--dark .app-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
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