import { ProxyAgent, setGlobalDispatcher } from "undici";
import { ofetch } from "ofetch";

export default defineNitroPlugin((nitro) => {
  if (process.env.HTTP_PROXY) {
    const proxyAgent = new ProxyAgent(process.env.HTTP_PROXY);
    setGlobalDispatcher(proxyAgent);
    const fetchWithProxy = ofetch.create({ dispatcher: proxyAgent });
    nitro.hooks.hook("request", (context) => {
      context.fetch = fetchWithProxy;
    });
  }
});
