window._ENV_ = {
  // These values are replaced by the entrypoint of Docker Image
  VUE_APP_MOCKED_DATA: "${VUE_APP_MOCKED_DATA}",
  VUE_APP_SCOPE: "${VUE_APP_SCOPE}",
  VUE_APP_GITHUB_ORG: "${VUE_APP_GITHUB_ORG}",
  VUE_APP_GITHUB_ENT: "${VUE_APP_GITHUB_ENT}",
  VUE_APP_GITHUB_TOKEN: "${VUE_APP_GITHUB_TOKEN}",
  VUE_APP_GITHUB_API: "${VUE_APP_GITHUB_API}",
  VUE_APP_GITHUB_TEAM: "${VUE_APP_GITHUB_TEAM}",
};

if(window._ENV_.VUE_APP_GITHUB_TOKEN) {
  console.warn('Using hardcoded token. This is not recommended for production.');
}
