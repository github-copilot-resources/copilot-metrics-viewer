/**
 * Suppress the known Nuxt DevTools Vue warning:
 * "Extraneous non-props attributes (style) were passed to component but could not
 *  be automatically inherited because component renders fragment or text root nodes."
 *
 * This warning originates from @nuxt/devtools' custom element anchor (webcomponents/index.mjs),
 * which renders as a fragment and receives a `style="z-index:999999; position:fixed"` from its
 * parent. It's a known DevTools bug and has no effect on the application.
 * See: https://github.com/nuxt/devtools/issues
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.warnHandler = (msg, _instance, trace) => {
    if (
      msg.includes('Extraneous non-props attributes') &&
      (trace?.includes('VueElement') || msg.includes('style'))
    ) {
      return; // suppress silently — it's from Nuxt DevTools' custom element anchor
    }
    // eslint-disable-next-line no-console
    console.warn('[Vue warn]:', msg, trace);
  };
});
