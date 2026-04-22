import { ofetch } from 'ofetch';
import { initializeProxyAgent } from '../utils/proxy-agent';

export default defineNitroPlugin((nitro) => {
  const proxyAgent = initializeProxyAgent();

  if (proxyAgent) {
    const fetchWithProxy = ofetch.create({
      dispatcher: proxyAgent,
      httpsProxy: process.env.HTTP_PROXY,
      proxy: false
    });

    nitro.hooks.hook('request', (context) => {
      context.fetch = fetchWithProxy;
    });
  }
});