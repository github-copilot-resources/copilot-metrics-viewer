export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  
  // Basic readiness check - application is ready to serve traffic
  return {
    status: 'ready',
    timestamp: new Date().toISOString(),
    version: config.public.version,
    checks: {
      server: 'ok',
      config: 'ok'
    }
  };
});