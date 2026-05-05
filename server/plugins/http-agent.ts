import { ofetch } from 'ofetch';
import { initializeProxyAgent } from '../utils/proxy-agent';

export default defineNitroPlugin((nitro) => {
  const proxyAgent = initializeProxyAgent();

  if (proxyAgent) {
    const fetchWithProxy = ofetch.create({
      dispatcher: proxyAgent,
      proxy: false
    } as Parameters<typeof ofetch.create>[0]);

    nitro.hooks.hook('request', (context) => {
      context.fetch = fetchWithProxy;
    });
  }
});