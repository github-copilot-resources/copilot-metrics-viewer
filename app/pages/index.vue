<script lang="ts" setup>
import { useRoute } from 'vue-router';
import './assets/global.css';

const route = useRoute();

// TODO: there might be a better way than overriding the config with route
const config = useRuntimeConfig();

if(route.query.mock) {
  config.public.isDataMocked = true;
  config.public.usingGithubAuth = false;
}

if (route.params.ent || route.params.org) {
  config.public.githubEnt = route.params.ent as string
  config.public.githubOrg = route.params.org as string

  
  // update scope
  if (route.params.org) {
    config.public.scope = 'organization'
  } else if (route.params.ent) {
    config.public.scope = 'enterprise'
  } 
}

// No org in URL or config — redirect to org picker, but only if the user is already
// authenticated (or auth is not required). When auth IS required and the user is not
// yet logged in, let MainComponent display the login overlay first; after OAuth the
// callback handler will redirect to /select-org or directly to the org.
const { loggedIn } = useUserSession()
const authRequired = config.public.usingGithubAuth || config.public.requireAuth || config.public.isPublicApp
const hasOrg = route.params.org || route.params.ent || config.public.githubOrg || config.public.githubEnt
if (!hasOrg && !config.public.isDataMocked && (!authRequired || loggedIn.value)) {
  await navigateTo('/select-org')
}

computed(() => config.public.version);
</script>

<template>
  <MainComponent />
</template>
