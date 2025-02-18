import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { ofetch } from 'ofetch';
import { readFileSync } from 'fs';

export default defineNitroPlugin((nitro) => {
  if (process.env.HTTP_PROXY) {
    const tlsOptions = process.env.CUSTOM_CA_PATH ? {
      tls: {
        ca: [
          readFileSync(process.env.CUSTOM_CA_PATH)
        ]
      }
    } : {};

    const proxyAgent = new ProxyAgent({
      uri: process.env.HTTP_PROXY,
      ...tlsOptions
    });
    
    setGlobalDispatcher(proxyAgent);
    
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